import { z } from "zod";

const cursorSchema = z.strictObject({
  version: z.literal(1),
  organisationId: z.uuid(),
  surname: z.string().min(1),
  id: z.uuid(),
});

export type StudentCursor = z.infer<typeof cursorSchema>;

export function encodeStudentCursor(cursor: StudentCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

const encodedCursorSchema = z.string().min(1).max(8192)
  .transform((value, context) => {
    try {
      const buffer = Buffer.from(value, "base64url");

      if (buffer.toString("base64url") !== value) {
        throw new Error("Invalid encoding");
      }

      const result = cursorSchema.safeParse(
        JSON.parse(buffer.toString("utf8")),
      );

      if (result.success) {
        return result.data;
      }
    } catch {
    }

    context.addIssue({
      code: "custom",
      message: "Invalid cursor",
    });

    return z.NEVER;
  });

export const studentPaginationSchema = z.strictObject({
  limit: z.string().trim().min(1)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default(25),
  cursor: encodedCursorSchema.optional(),
});
