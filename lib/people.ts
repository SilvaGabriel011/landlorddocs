// Name matching for people on an application. Uploads name the same
// person in many ways ("Gabriel Silva", "Pedro Gabriel Alves da Silva",
// "pedro gabriel ALVES DA SILVA"), so comparisons are token-based:
// accent- and case-insensitive, connectives dropped, and a shorter name
// matches a longer one when all of its tokens appear there.

const CONNECTIVES = new Set(["da", "de", "do", "das", "dos", "e", "di", "du"]);

export function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function nameTokens(s: string): string[] {
  return normName(s)
    .split(" ")
    .filter((t) => t && !CONNECTIVES.has(t));
}

// "Gabriel Silva" matches "Pedro Gabriel Alves da Silva"; case and
// accents never matter.
export function samePerson(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return short.every((t) => long.includes(t));
}

export function cleanPersonName(s: string): string {
  return s.trim().replace(/\s+/g, " ").slice(0, 80);
}
