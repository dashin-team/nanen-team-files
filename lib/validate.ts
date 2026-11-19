import {
  BLOB_NAMESPACE,
  DEFAULT_FOLDERS,
  EXT_TO_MIME,
  MAX_FILENAME_LENGTH,
  MAX_FOLDER_LENGTH,
  MAX_UPLOADER_LENGTH,
  limitForExtension,
} from "@/lib/constants";
import { HttpError } from "@/lib/errors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function extensionOf(filename: string): string {
  const trimmed = filename.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0 || dot === trimmed.length - 1) return "";
  return trimmed.slice(dot + 1).toLowerCase();
}

export function baseNameOf(filename: string): string {
  const extension = extensionOf(filename);
  if (!extension) return filename.trim();
  return filename.trim().slice(0, -(extension.length + 1));
}

export function sanitizeFilename(input: string): string {
  return input
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FILENAME_LENGTH);
}

export function fileRejection(name: string, size: number): string | null {
  const cleaned = sanitizeFilename(name);
  const extension = extensionOf(cleaned);
  if (!cleaned || !extension || !baseNameOf(cleaned)) {
    return "請保留副檔名，例如報告.pdf。";
  }
  if (!EXT_TO_MIME[extension]) {
    return "不支援這個格式。可以上傳 PDF、圖片、Word、Excel、PowerPoint 和影片。";
  }
  if (!Number.isFinite(size) || size <= 0) return "檔案是空的。";
  const limit = limitForExtension(extension);
  if (size > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    return `檔案超過 ${mb} MB 上限。`;
  }
  return null;
}

export function assertFileAllowed(name: string, size: number): {
  name: string;
  extension: string;
  contentType: string;
} {
  const cleaned = sanitizeFilename(name);
  const reason = fileRejection(cleaned, size);
  if (reason) throw new HttpError(400, reason);
  const extension = extensionOf(cleaned);
  return {
    name: cleaned,
    extension,
    contentType: EXT_TO_MIME[extension],
  };
}

export function renameKeepingExtension(currentName: string, nextName: string): string {
  const currentExtension = extensionOf(currentName);
  if (!currentExtension) throw new HttpError(400, "原檔名不正確。");
  let cleaned = sanitizeFilename(nextName);
  const nextExtension = extensionOf(cleaned);
  if (!nextExtension) {
    cleaned = sanitizeFilename(`${cleaned}.${currentExtension}`);
  } else if (nextExtension !== currentExtension) {
    throw new HttpError(400, "不能改成別的檔案格式。若要換格式，請重新上傳。");
  }
  const reason = fileRejection(cleaned, 1);
  if (reason && reason !== "檔案是空的。") throw new HttpError(400, reason);
  if (!baseNameOf(cleaned)) throw new HttpError(400, "請填檔名。");
  return cleaned;
}

export function sanitizePersonName(input: string): string {
  const cleaned = input
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 1 || cleaned.length > MAX_UPLOADER_LENGTH) {
    throw new HttpError(400, `請填上名字，${MAX_UPLOADER_LENGTH} 個字以內。`);
  }
  return cleaned;
}

export function sanitizeFolderName(input: string): string {
  const cleaned = input
    .replace(/[\u0000-\u001f\u007f/\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 1 || cleaned.length > MAX_FOLDER_LENGTH) {
    throw new HttpError(400, `資料夾名稱請在 ${MAX_FOLDER_LENGTH} 個字以內。`);
  }
  if ((DEFAULT_FOLDERS as readonly string[]).includes(cleaned)) return cleaned;
  return cleaned;
}

export function isPrivateBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.hostname.endsWith(".private.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

export function isSafeBlobPath(pathname: string, id: string): boolean {
  if (!isUuid(id)) return false;
  if (pathname.includes("..") || pathname.includes("\\") || pathname.startsWith("/")) {
    return false;
  }
  const parts = pathname.split("/");
  if (parts.length !== 3 || parts[0] !== BLOB_NAMESPACE || parts[1] !== "files") return false;
  const leaf = parts[2] ?? "";
  return leaf === id || leaf.startsWith(`${id}-`) || leaf.startsWith(`${id}.`);
}

export function contentDisposition(filename: string, download: boolean): string {
  const fallback =
    filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "") || "download";
  const type = download ? "attachment" : "inline";
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
