export const DEFAULT_FOLDERS = ["客戶檔案", "講師分類", "月會檔案"] as const;

/** Blob path prefix so this library never shares objects with another site in the same store. */
export const BLOB_NAMESPACE = "shihan";

/**
 * Vercel Blob Hobby includes 1 GB/month of storage.
 * @see https://vercel.com/docs/vercel-blob/usage-and-pricing
 * 1024³ bytes so the on-screen total reads「1 GB」, in the same units as file sizes.
 */
export const DEFAULT_BLOB_QUOTA_BYTES = 1024 * 1024 * 1024;

export function blobCatalogPath(): string {
  return `${BLOB_NAMESPACE}/catalog/index.json`;
}

export function blobObjectPath(id: string): string {
  return `${BLOB_NAMESPACE}/files/${id}`;
}

export const DOCUMENT_MAX_BYTES = 40 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const MAX_CUSTOM_FOLDERS = 30;
export const MAX_FILENAME_LENGTH = 80;
export const MAX_FOLDER_LENGTH = 16;
export const MAX_UPLOADER_LENGTH = 20;

export const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm"]);
export const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
export const PDF_EXTENSIONS = new Set(["pdf"]);
export const PLAYABLE_VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov"]);

export const ACCEPT = Object.keys(EXT_TO_MIME)
  .map((extension) => `.${extension}`)
  .join(",");

export const ALLOWED_CONTENT_TYPES = [
  ...new Set([...Object.values(EXT_TO_MIME), "application/octet-stream"]),
];

export const NAME_STORAGE_KEY = "shihan-uploader-name";
export const DEFAULT_UPLOADER_NAME = "仕翰";

export function limitForExtension(extension: string): number {
  return VIDEO_EXTENSIONS.has(extension) ? VIDEO_MAX_BYTES : DOCUMENT_MAX_BYTES;
}

export function canPreview(extension: string): boolean {
  return (
    IMAGE_EXTENSIONS.has(extension) ||
    PDF_EXTENSIONS.has(extension) ||
    PLAYABLE_VIDEO_EXTENSIONS.has(extension)
  );
}

export function previewKind(extension: string): "image" | "pdf" | "video" | "none" {
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (PDF_EXTENSIONS.has(extension)) return "pdf";
  if (PLAYABLE_VIDEO_EXTENSIONS.has(extension)) return "video";
  return "none";
}

export function typeLabel(extension: string): string {
  if (extension === "pdf") return "PDF";
  if (IMAGE_EXTENSIONS.has(extension) || extension === "heic" || extension === "heif") return "圖片";
  if (extension === "doc" || extension === "docx") return "Word";
  if (extension === "xls" || extension === "xlsx" || extension === "csv") return "表格";
  if (extension === "ppt" || extension === "pptx") return "簡報";
  if (VIDEO_EXTENSIONS.has(extension)) return "影片";
  return "檔案";
}
