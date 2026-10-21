import assert from "node:assert/strict";
import { test } from "node:test";
import { describeDatabaseError } from "../src/database-errors.js";

test("reads codes from a wrapped Prisma error", () => {
  const error = Object.assign(new Error("message with host 10.0.0.5"), {
    name: "PrismaClientKnownRequestError",
    code: "P2010",
    meta: {
      driverAdapterError: {
        cause: { kind: "postgres", code: "57014", message: "secret" },
      },
    },
  });

  assert.deepEqual(describeDatabaseError(error), {
    errorName: "PrismaClientKnownRequestError",
    errorCode: "P2010",
    adapterKind: "postgres",
    sqlState: "57014",
  });
});

test("reads codes from a raw driver adapter error", () => {
  const error = Object.assign(new Error("restrict"), {
    name: "DriverAdapterError",
    cause: { kind: "postgres", code: "23001", detail: "Key (id)=(...)" },
  });

  assert.deepEqual(describeDatabaseError(error), {
    errorName: "DriverAdapterError",
    errorCode: undefined,
    adapterKind: "postgres",
    sqlState: "23001",
  });
});

test("keeps the error name when the cause has another shape", () => {
  const error = new TypeError("fetch failed", {
    cause: { code: "ECONNREFUSED" },
  });

  assert.deepEqual(describeDatabaseError(error), {
    errorName: "TypeError",
    errorCode: undefined,
    adapterKind: undefined,
    sqlState: undefined,
  });
});

test("classifies non-error values as unknown", () => {
  assert.deepEqual(describeDatabaseError("boom"), { errorName: "UnknownError" });
});
