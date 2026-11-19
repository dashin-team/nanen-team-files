import { EXT_TO_MIME, blobObjectPath } from "@/lib/constants";
import { extensionOf, fileRejection } from "@/lib/validate";
import type { PublicFile } from "@/lib/storage/types";

export async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    const error = new Error(data.error || "操作沒有完成，請再試一次。") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data;
}

function contentTypeFor(filename: string): string {
  return EXT_TO_MIME[extensionOf(filename)] ?? "application/octet-stream";
}

export function uploadLocal(
  file: File,
  folder: string,
  uploader: string,
  onProgress: (percent: number) => void,
): Promise<PublicFile> {
  const rejection = fileRejection(file.name, file.size);
  if (rejection) return Promise.reject(new Error(rejection));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let body: { error?: string; file?: PublicFile } = {};
      try {
        body = JSON.parse(xhr.responseText) as { error?: string; file?: PublicFile };
      } catch {
        body = {};
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.file) {
        onProgress(100);
        resolve(body.file);
        return;
      }
      reject(new Error(body.error || "上傳失敗，請再試一次。"));
    };
    xhr.onerror = () => reject(new Error("網路連線中斷，請再試一次。"));
    const data = new FormData();
    data.set("file", file);
    data.set("folder", folder);
    data.set("uploader", uploader);
    xhr.send(data);
  });
}

export async function uploadBlob(
  file: File,
  folder: string,
  uploader: string,
  onProgress: (percent: number) => void,
): Promise<PublicFile> {
  const rejection = fileRejection(file.name, file.size);
  if (rejection) throw new Error(rejection);
  const { upload } = await import("@vercel/blob/client");
  const id = crypto.randomUUID();
  await upload(blobObjectPath(id), file, {
    access: "private",
    handleUploadUrl: "/api/blob",
    contentType: contentTypeFor(file.name),
    multipart: file.size > 8 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
  });
  onProgress(100);
  const response = await fetch("/api/files", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, name: file.name, folder, uploader }),
  });
  const data = await readJson<{ file: PublicFile }>(response);
  return data.file;
}
