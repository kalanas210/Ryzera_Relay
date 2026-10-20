// Mohamed is a given first name, not what he is called. Mohamed Rizwan is "Rizwan".
const GIVEN_FIRST = new Set(["mohamed", "mohammed", "muhammad", "mohammad", "mohomed"]);

export function calledName(full: string | null | undefined): string {
  if (!full) return "";
  const parts = full.trim().split(/\s+/);
  const [first = "", second] = parts;
  return second && GIVEN_FIRST.has(first.toLowerCase()) ? second : first;
}
