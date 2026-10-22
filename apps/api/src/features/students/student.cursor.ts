import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { z } from "zod";
import { MAX_SURNAME_LENGTH, surnameLength } from "./student.limits.js";

const ALGORITHM = "aes-256-gcm";
const TOKEN_VERSION = 1;
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const HEADER = Buffer.from([TOKEN_VERSION]);
const SEARCH_HASH_LENGTH = 64;

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const MAX_JSON_BYTES_PER_CODE_POINT = 6;
const MAX_PAYLOAD_BYTES =
  Buffer.byteLength(
    JSON.stringify({
      organisationId: NIL_UUID,
      surname: "",
      id: NIL_UUID,
      searchHash: "0".repeat(SEARCH_HASH_LENGTH),
    }),
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
  searchHash: z.string().length(SEARCH_HASH_LENGTH).optional(),
});

export type StudentCursor = z.infer<typeof cursorPayloadSchema>;

export type StudentCursorCodec = {
  encode(cursor: StudentCursor): string;
  decode(token: string): StudentCursor | null;
};

export function searchHash(search: string | undefined): string | undefined {
  return search
    ? createHash("sha256").update(search).digest("hex")
    : undefined;
}

export function parseStudentCursorKey(value: string | undefined): Buffer {
  const key = Buffer.from(value ?? "", "base64");

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
        return null;
      }
    },
  };
}
