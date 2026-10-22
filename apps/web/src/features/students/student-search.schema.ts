import { z } from "zod";

export const MAX_SEARCH_LENGTH = 100;

export const studentSearchSchema = z.string().trim().max(MAX_SEARCH_LENGTH)
  .optional();
