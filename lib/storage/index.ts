import { HttpError } from "@/lib/errors";
import { blobStorage } from "@/lib/storage/blob";
import { localStorage as localDriver } from "@/lib/storage/local";

export type StorageMode = "blob" | "local" | "unconfigured";

function onVercel(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL);
}

export function storageMode(): StorageMode {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "blob";
  if (onVercel()) return "unconfigured";
  return "local";
}

export function getStorage() {
  const mode = storageMode();
  if (mode === "blob") return blobStorage;
  if (mode === "local") return localDriver;
  throw new HttpError(503, "雲端儲存還沒設定。請在 Vercel 接上私有的 Blob 儲存庫。");
}

export type TeamStorage = ReturnType<typeof getStorage>;
