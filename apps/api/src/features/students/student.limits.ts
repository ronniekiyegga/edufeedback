export const MAX_SURNAME_LENGTH = 100;
export const MAX_SEARCH_LENGTH = 100;

export function surnameLength(surname: string): number {
  return [...surname].length;
}
