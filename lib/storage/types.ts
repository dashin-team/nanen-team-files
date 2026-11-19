import { DEFAULT_FOLDERS } from "@/lib/constants";

export type StoredFile = {
  id: string;
  name: string;
  folder: string;
  uploader: string;
  uploadedAt: string;
  size: number;
  contentType: string;
  pathname: string;
};

export type Catalog = {
  version: 1;
  folders: string[];
  files: StoredFile[];
};

export type PublicFile = {
  id: string;
  name: string;
  folder: string;
  uploader: string;
  uploadedAt: string;
  size: number;
  contentType: string;
  extension: string;
};

export type FileBody = {
  file: StoredFile;
  stream: ReadableStream<Uint8Array>;
  status: 200 | 206;
  contentLength: number;
  contentRange?: string;
};

function isStoredFile(value: unknown): value is StoredFile {
  if (!value || typeof value !== "object") return false;
  const file = value as StoredFile;
  return (
    typeof file.id === "string" &&
    typeof file.name === "string" &&
    typeof file.folder === "string" &&
    typeof file.uploader === "string" &&
    typeof file.uploadedAt === "string" &&
    typeof file.size === "number" &&
    typeof file.contentType === "string" &&
    typeof file.pathname === "string"
  );
}

export function emptyCatalog(): Catalog {
  return { version: 1, folders: [...DEFAULT_FOLDERS] as string[], files: [] };
}

export function normalizeCatalog(input: unknown): Catalog {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const rawFolders = Array.isArray(record.folders) ? record.folders : [];
  const rawFiles = Array.isArray(record.files) ? record.files : [];
  const folders: string[] = [...DEFAULT_FOLDERS];
  for (const folder of rawFolders) {
    if (typeof folder === "string" && folder.trim() && !folders.includes(folder)) {
      folders.push(folder);
    }
  }
  const files: StoredFile[] = [];
  for (const item of rawFiles) {
    if (!isStoredFile(item)) continue;
    files.push(item);
    if (!folders.includes(item.folder)) folders.push(item.folder);
  }
  return { version: 1, folders, files };
}

export function toPublicFile(file: StoredFile): PublicFile {
  const dot = file.name.lastIndexOf(".");
  const extension = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  return {
    id: file.id,
    name: file.name,
    folder: file.folder,
    uploader: file.uploader,
    uploadedAt: file.uploadedAt,
    size: file.size,
    contentType: file.contentType,
    extension,
  };
}
