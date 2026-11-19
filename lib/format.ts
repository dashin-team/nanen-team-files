export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) {
    const value = bytes / 1024;
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} KB`;
  }
  const gigabyte = 1024 * 1024 * 1024;
  if (bytes >= gigabyte * 0.995) {
    const gigabytes = bytes / gigabyte;
    if (gigabytes >= 10 || Math.abs(gigabytes - Math.round(gigabytes)) < 0.05) {
      return `${Math.round(gigabytes)} GB`;
    }
    return `${gigabytes.toFixed(1)} GB`;
  }
  const value = bytes / (1024 * 1024);
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} MB`;
}

function taipeiDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const key = taipeiDay(date);
  if (key === taipeiDay(now)) return `今天 ${time}`;
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (key === taipeiDay(yesterday)) return `昨天 ${time}`;
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
