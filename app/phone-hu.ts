/** Magyar mobil: csak a +36 utáni rész (pl. 20 531 0087). */
export function formatHuPhoneForApi(localPart: string): string {
  const digits = localPart.replace(/\D/g, "");
  let normalized = digits;
  if (normalized.startsWith("36")) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith("0")) {
    normalized = normalized.slice(1);
  }
  if (normalized.length < 9 || normalized.length > 9) {
    throw new Error("Adj meg érvényes magyar mobilszámot (9 számjegy, pl. 20 531 0087).");
  }
  return `+36${normalized}`;
}

export function formatHuPhoneDisplay(e164: string): string {
  const match = e164.match(/^\+36(\d{2})(\d{3})(\d{4})$/);
  if (!match) return e164;
  return `+36 ${match[1]} ${match[2]} ${match[3]}`;
}
