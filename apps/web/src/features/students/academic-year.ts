import { z } from "zod";

export const MIN_ACADEMIC_YEAR_START = 1;
export const MAX_ACADEMIC_YEAR_START = 9998;

export const academicYearStartSchema = z.number().int()
  .min(MIN_ACADEMIC_YEAR_START)
  .max(MAX_ACADEMIC_YEAR_START);

export const academicYearParamSchema = z.string()
  .regex(/^\d{1,4}$/)
  .transform(Number)
  .pipe(academicYearStartSchema)
  .optional();

export function formatAcademicYear(academicYearStart: number): string {
  const nextYear = String((academicYearStart + 1) % 100).padStart(2, "0");
  return `${academicYearStart}/${nextYear}`;
}
