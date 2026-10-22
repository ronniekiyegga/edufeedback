import { z } from "zod";
import { academicYearStartSchema } from "./academic-year";

export const academicYearsSchema = z.object({
  academicYearStarts: z.array(academicYearStartSchema).refine(
    (years) => years.every((year, index) => index === 0 || year < years[index - 1]),
    "Academic years must be unique and newest first",
  ),
});

export const studentPageSchema = z.object({
  items: z.array(z.object({
    id: z.uuid(),
    institutionStudentRef: z.string(),
    firstName: z.string().nullable(),
    surname: z.string(),
    yearGroup: z.number().int().positive(),
    classGroup: z.string().nullable(),
  })).max(100),
  nextCursor: z.string().min(1).nullable(),
  limit: z.number().int().min(1).max(100),
});

export type StudentPage = z.infer<typeof studentPageSchema>;
