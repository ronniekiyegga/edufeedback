import { z } from "zod";

export const studentPageSchema = z.object({
  items: z.array(z.object({
    id: z.uuid(),
    institutionStudentRef: z.string(),
    firstName: z.string().nullable(),
    surname: z.string(),
  })).max(100),
  nextCursor: z.string().min(1).nullable(),
  limit: z.number().int().min(1).max(100),
});

export type StudentPage = z.infer<typeof studentPageSchema>;
