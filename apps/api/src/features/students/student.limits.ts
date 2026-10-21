// Mirrors `surname VARCHAR(100)` in prisma/schema.prisma. One hundred
// characters leaves generous room for real multi-part surnames while
// keeping cursors short. PostgreSQL counts code points, not UTF-16 units,
// so code comparing against this limit must count the same way.
export const MAX_SURNAME_LENGTH = 100;

export function surnameLength(surname: string): number {
  return [...surname].length;
}
