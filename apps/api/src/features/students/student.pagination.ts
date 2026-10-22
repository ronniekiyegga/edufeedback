import { z } from "zod";
import { MAX_CURSOR_LENGTH, type StudentCursorCodec } from "./student.cursor.js";
import { MAX_SEARCH_LENGTH } from "./student.limits.js";

export function createStudentPaginationSchema(cursorCodec: StudentCursorCodec) {
  return z.strictObject({
    limit: z.string().trim().min(1)
      .transform(Number)
      .pipe(z.number().int().min(1).max(100))
      .default(25),
    q: z.string().trim().max(MAX_SEARCH_LENGTH).optional(),
    cursor: z.string().min(1).max(MAX_CURSOR_LENGTH)
      .transform((token, context) => {
        const cursor = cursorCodec.decode(token);

        if (!cursor) {
          context.addIssue({ code: "custom", message: "Invalid cursor" });
          return z.NEVER;
        }

        return cursor;
      })
      .optional(),
  });
}
