import { BLOB_NAMESPACE, DEFAULT_BLOB_QUOTA_BYTES } from "@/lib/constants";
import { HttpError } from "@/lib/errors";
import { formatSize } from "@/lib/format";
import type { StoredFile } from "@/lib/storage/types";

export type LibraryUsage = {
  usedBytes: number;
  quotaBytes: number;
  remainingBytes: number;
  folderBytes: Record<string, number>;
};

/** Byte cap for the storage meter. `BLOB_QUOTA_BYTES` overrides the Hobby 1 GB default. */
export function blobQuotaBytes(): number {
  const raw = process.env.BLOB_QUOTA_BYTES?.trim();
  if (!raw) return DEFAULT_BLOB_QUOTA_BYTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_BLOB_QUOTA_BYTES;
  return Math.floor(parsed);
}

/**
 * Cloud files count only when they live under `shihan/`.
 * Local practice files live at `blobs/<id>` in this app's own `.data` folder.
 * Paths such as `files/<id>` belong to the other site and are ignored.
 */
export function countsTowardUsage(pathname: string): boolean {
  return pathname.startsWith(`${BLOB_NAMESPACE}/`) || pathname.startsWith("blobs/");
}

export function summarizeUsage(files: StoredFile[], quotaBytes = blobQuotaBytes()): LibraryUsage {
  const folderBytes: Record<string, number> = {};
  let usedBytes = 0;
  for (const file of files) {
    if (!countsTowardUsage(file.pathname)) continue;
    const size = Number.isFinite(file.size) && file.size > 0 ? file.size : 0;
    usedBytes += size;
    folderBytes[file.folder] = (folderBytes[file.folder] ?? 0) + size;
  }
  return {
    usedBytes,
    quotaBytes,
    remainingBytes: Math.max(0, quotaBytes - usedBytes),
    folderBytes,
  };
}

export function assertFitsQuota(files: StoredFile[], incomingBytes: number): void {
  const usage = summarizeUsage(files);
  if (!Number.isFinite(incomingBytes) || incomingBytes < 0 || incomingBytes > usage.remainingBytes) {
    const left = formatSize(usage.remainingBytes) || "0 B";
    throw new HttpError(400, `空間不夠。還可以放 ${left}。`);
  }
}
