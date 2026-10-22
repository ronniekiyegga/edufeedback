export const MAX_SURNAME_LENGTH = 100;
export const MAX_SEARCH_LENGTH = 100;
export const MIN_ACADEMIC_YEAR_START = 1;
export const MAX_ACADEMIC_YEAR_START = 9998;

export function surnameLength(surname: string): number {
  return [...surname].length;
}
