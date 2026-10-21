import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import {
  createStudentCursorCodec,
  MAX_CURSOR_LENGTH,
  parseStudentCursorKey,
  type StudentCursor,
} from "../src/features/students/student.cursor.js";
import { MAX_SURNAME_LENGTH } from "../src/features/students/student.limits.js";

const cursor: StudentCursor = {
  organisationId: "11111111-1111-4111-8111-111111111111",
  surname: "Dunmerrow",
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

const codec = createStudentCursorCodec(randomBytes(32));

function flipByte(token: string, index: number) {
  const bytes = Buffer.from(token, "base64url");
  bytes[index] ^= 0x01;
  return bytes.toString("base64url");
}

test("round-trips a cursor without exposing its contents", () => {
  const token = codec.encode(cursor);
  const decoded = Buffer.from(token, "base64url").toString("latin1");

  assert.deepEqual(codec.decode(token), cursor);
  assert.ok(!decoded.includes(cursor.surname));
  assert.ok(!decoded.includes(cursor.id));
});

test("uses a fresh nonce for every token", () => {
  assert.notEqual(codec.encode(cursor), codec.encode(cursor));
});

test("rejects tampering with any part of the token", () => {
  const token = codec.encode(cursor);
  const length = Buffer.from(token, "base64url").length;

  const regions = {
    version: 0,
    nonce: 1,
    ciphertext: 13,
    tag: length - 1,
  };

  for (const [region, index] of Object.entries(regions)) {
    assert.equal(codec.decode(flipByte(token, index)), null, region);
  }
});

test("rejects tokens issued with a different key", () => {
  const otherCodec = createStudentCursorCodec(randomBytes(32));

  assert.equal(codec.decode(otherCodec.encode(cursor)), null);
});

test("rejects malformed tokens", () => {
  const token = codec.encode(cursor);

  const malformed = [
    "",
    "not base64url!",
    `${token}=`,
    token.slice(0, 20),
    Buffer.alloc(40).toString("base64url"),
  ];

  for (const value of malformed) {
    assert.equal(codec.decode(value), null, value);
  }
});

test("every surname at the length limit fits the cursor limit", () => {
  const longest = {
    // Control characters are escaped as \u00XX: the most JSON bytes per
    // code point, so this token sits exactly at the limit.
    controlCharacters: "\u0001".repeat(MAX_SURNAME_LENGTH),
    astralCharacters: "\u{1F600}".repeat(MAX_SURNAME_LENGTH),
    quotes: "\"".repeat(MAX_SURNAME_LENGTH),
  };

  for (const [kind, surname] of Object.entries(longest)) {
    const token = codec.encode({ ...cursor, surname });

    assert.ok(token.length <= MAX_CURSOR_LENGTH, kind);
    assert.deepEqual(codec.decode(token), { ...cursor, surname }, kind);
  }

  assert.equal(
    codec.encode({ ...cursor, surname: longest.controlCharacters }).length,
    MAX_CURSOR_LENGTH,
  );
});

test("rejects a payload surname beyond the length limit", () => {
  const surname = "a".repeat(MAX_SURNAME_LENGTH + 1);

  assert.equal(codec.decode(codec.encode({ ...cursor, surname })), null);
});

test("rejects an authentic token whose payload is not a cursor", () => {
  const invalidPayload = { ...cursor, id: "not-a-uuid" };

  assert.equal(codec.decode(codec.encode(invalidPayload)), null);
});

test("accepts only a canonical base64 32-byte key", () => {
  const valid = randomBytes(32).toString("base64");

  assert.equal(parseStudentCursorKey(valid).length, 32);

  const invalid = [
    undefined,
    "",
    randomBytes(16).toString("base64"),
    randomBytes(33).toString("base64"),
    `${valid.slice(0, -1)}`,
    `${valid} `,
  ];

  for (const value of invalid) {
    assert.throws(
      () => parseStudentCursorKey(value),
      (error: Error) => !value || !error.message.includes(value),
    );
  }
});
