export function parseByteRange(
  header: string,
  size: number,
): { start: number; end: number } | "unsatisfiable" | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size <= 0) return null;
  const startText = match[1] ?? "";
  const endText = match[2] ?? "";
  if (startText === "" && endText === "") return null;

  if (startText === "") {
    const suffix = Number(endText);
    if (!Number.isInteger(suffix) || suffix <= 0) return "unsatisfiable";
    const start = Math.max(size - suffix, 0);
    return { start, end: size - 1 };
  }

  const start = Number(startText);
  const end = endText === "" ? size - 1 : Number(endText);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
    return "unsatisfiable";
  }
  return { start, end: Math.min(end, size - 1) };
}
