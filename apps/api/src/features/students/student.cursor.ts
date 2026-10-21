import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { MAX_SURNAME_LENGTH, surnameLength } from "./student.limits.js";

// Token layout, base64url encoded:
//   version (1 byte) | nonce (12 bytes) | ciphertext | auth tag (16 bytes)
// AES-256-GCM hides the surname and ID from URLs and logs, and rejects any
// altered token. The version byte is authenticated as additional data.
//
// Encryption is not authorisation: callers still scope every query to the
// requester's organisation. Rotating the key invalidates issued cursors.
const ALGORITHM = "aes-256-gcm";
const TOKEN_VERSION = 1;
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const HEADER = Buffer.from([TOKEN_VERSION]);

// JSON.stringify writes at most 6 bytes per code point (a \u00XX escape for
// control characters), so this is the longest payload any stored surname
// can produce. Every cursor the API issues therefore fits the limit below.
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const MAX_JSON_BYTES_PER_CODE_POINT = 6;
const MAX_PAYLOAD_BYTES =
  Buffer.byteLength(
    JSON.stringify({ organisationId: NIL_UUID, surname: "", id: NIL_UUID }),
  ) + MAX_SURNAME_LENGTH * MAX_JSON_BYTES_PER_CODE_POINT;

export const MAX_CURSOR_LENGTH = Math.ceil(
  ((HEADER.length + NONCE_BYTES + MAX_PAYLOAD_BYTES + TAG_BYTES) * 4) / 3,
);

const cursorPayloadSchema = z.strictObject({
  organisationId: z.uuid(),
  surname: z.string().min(1).refine(
    (surname) => surnameLength(surname) <= MAX_SURNAME_LENGTH,
  ),
  id: z.uuid(),
});

export type StudentCursor = z.infer<typeof cursorPayloadSchema>;

export type StudentCursorCodec = {
  encode(cursor: StudentCursor): string;
  decode(token: string): StudentCursor | null;
};

export function parseStudentCursorKey(value: string | undefined): Buffer {
  const key = Buffer.from(value ?? "", "base64");

  // Buffer.from skips invalid characters, so re-encoding proves the input
  // was canonical base64 rather than a truncated or padded variant.
  if (key.length !== KEY_BYTES || key.toString("base64") !== value) {
    throw new Error(
      `STUDENT_CURSOR_KEY must be ${KEY_BYTES} random bytes encoded as base64`,
    );
  }

  return key;
}

function splitToken(token: string) {
  const bytes = Buffer.from(token, "base64url");
  const minimumLength = HEADER.length + NONCE_BYTES + TAG_BYTES + 1;

  if (
    bytes.toString("base64url") !== token ||
    bytes.length < minimumLength ||
    bytes[0] !== TOKEN_VERSION
  ) {
    return null;
  }

  const nonceEnd = HEADER.length + NONCE_BYTES;

  return {
    nonce: bytes.subarray(HEADER.length, nonceEnd),
    ciphertext: bytes.subarray(nonceEnd, bytes.length - TAG_BYTES),
    tag: bytes.subarray(bytes.length - TAG_BYTES),
  };
}

export function createStudentCursorCodec(key: Buffer): StudentCursorCodec {
  return {
    encode(cursor) {
      const nonce = randomBytes(NONCE_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, nonce, {
        authTagLength: TAG_BYTES,
      });
      cipher.setAAD(HEADER);

      const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(cursor), "utf8"),
        cipher.final(),
      ]);

      return Buffer.concat([HEADER, nonce, ciphertext, cipher.getAuthTag()])
        .toString("base64url");
    },

    decode(token) {
      const parts = splitToken(token);

      if (!parts) {
        return null;
      }

      try {
        const decipher = createDecipheriv(ALGORITHM, key, parts.nonce, {
          authTagLength: TAG_BYTES,
        });
        decipher.setAAD(HEADER);
        decipher.setAuthTag(parts.tag);

        const plaintext = Buffer.concat([
          decipher.update(parts.ciphertext),
          decipher.final(),
        ]).toString("utf8");

        const payload = cursorPayloadSchema.safeParse(JSON.parse(plaintext));
        return payload.success ? payload.data : null;
      } catch {
        // final() throws when authentication fails and JSON.parse throws on
        // a malformed payload; both mean the token is not one we issued.
        return null;
      }
    },
  };
}
