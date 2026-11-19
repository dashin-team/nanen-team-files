export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class RangeNotSatisfiableError extends HttpError {
  constructor(public size: number) {
    super(416, "無法讀取這一段檔案。");
    this.name = "RangeNotSatisfiableError";
  }
}

export function errorMessage(error: unknown, fallback = "系統忙碌，請稍後再試。"): string {
  if (error instanceof HttpError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
