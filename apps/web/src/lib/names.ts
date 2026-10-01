/** The name people are called by, as the design writes it: "Kasun" for Kasun Bandara, "Rizwan" for Mohamed
 *  Rizwan (the Mohamed is a given first element, not what he is called). */
const GIVEN_FIRST = new Set(["mohamed", "mohammed", "muhammad", "mohammad", "mohomed"]);

export function calledName(full: string | null | undefined): string {
  if (!full) return "";
  const parts = full.trim().split(/\s+/);
  const [first = "", second] = parts;
  return second && GIVEN_FIRST.has(first.toLowerCase()) ? second : first;
}
