import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { DEFAULT_FOLDERS, MAX_CUSTOM_FOLDERS } from "@/lib/constants";
import { HttpError, RangeNotSatisfiableError } from "@/lib/errors";
import { parseByteRange } from "@/lib/range";
import {
  assertFileAllowed,
  isUuid,
  renameKeepingExtension,
  sanitizeFolderName,
  sanitizePersonName,
} from "@/lib/validate";
import { assertFitsQuota } from "@/lib/usage";
import { type Catalog, type FileBody, type StoredFile, emptyCatalog, normalizeCatalog } from "@/lib/storage/types";

function dataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), ".data");
}

function catalogPath(): string {
  return path.join(dataDir(), "catalog.json");
}

function blobFile(id: string): string {
  if (!isUuid(id)) throw new HttpError(400, "檔案編號不正確。");
  const root = path.resolve(dataDir(), "blobs");
  const full = path.resolve(root, id);
  if (!full.startsWith(root + path.sep)) throw new HttpError(400, "檔案編號不正確。");
  return full;
}

let queue: Promise<unknown> = Promise.resolve();

function locked<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readCatalog(): Promise<Catalog> {
  try {
    const raw = await readFile(catalogPath(), "utf8");
    return normalizeCatalog(JSON.parse(raw) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyCatalog();
    if (error instanceof SyntaxError) {
      throw new HttpError(500, "資料清單讀取失敗，請聯絡管理員。");
    }
    throw error;
  }
}

async function writeCatalog(catalog: Catalog): Promise<void> {
  const directory = dataDir();
  await mkdir(directory, { recursive: true });
  const target = catalogPath();
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(catalog));
  await rename(temporary, target);
}

function requireFolder(catalog: Catalog, folder: string): string {
  const name = sanitizeFolderName(folder);
  if (!catalog.folders.includes(name)) throw new HttpError(400, "請先選擇資料夾。");
  return name;
}

export const localStorage = {
  mode: "local" as const,

  list(): Promise<Catalog> {
    return locked(() => readCatalog());
  },

  createFolder(folderName: string): Promise<Catalog> {
    return locked(async () => {
      const catalog = await readCatalog();
      const name = sanitizeFolderName(folderName);
      if (catalog.folders.includes(name)) throw new HttpError(400, "已經有這個資料夾。");
      const customCount = catalog.folders.filter(
        (folder) => !(DEFAULT_FOLDERS as readonly string[]).includes(folder),
      ).length;
      if (customCount >= MAX_CUSTOM_FOLDERS) {
        throw new HttpError(400, "資料夾太多了，請先用現有的分類。");
      }
      const next = { ...catalog, folders: [...catalog.folders, name] };
      await writeCatalog(next);
      return next;
    });
  },

  deleteFolder(folderName: string): Promise<Catalog> {
    return locked(async () => {
      const catalog = await readCatalog();
      const name = sanitizeFolderName(folderName);
      if ((DEFAULT_FOLDERS as readonly string[]).includes(name)) {
        throw new HttpError(400, "預設資料夾不能刪除。");
      }
      if (!catalog.folders.includes(name)) throw new HttpError(404, "找不到這個資料夾。");
      if (catalog.files.some((file) => file.folder === name)) {
        throw new HttpError(400, "資料夾裡還有檔案，請先移走或刪除。");
      }
      const next = { ...catalog, folders: catalog.folders.filter((folder) => folder !== name) };
      await writeCatalog(next);
      return next;
    });
  },

  async addBytes(input: { name: string; folder: string; uploader: string; bytes: Uint8Array }): Promise<StoredFile> {
    const checked = assertFileAllowed(input.name, input.bytes.byteLength);
    const uploader = sanitizePersonName(input.uploader);
    const id = randomUUID();
    const destination = blobFile(id);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, input.bytes);
    try {
      return await locked(async () => {
        const catalog = await readCatalog();
        assertFitsQuota(catalog.files, input.bytes.byteLength);
        const folder = requireFolder(catalog, input.folder);
        const file: StoredFile = {
          id,
          name: checked.name,
          folder,
          uploader,
          uploadedAt: new Date().toISOString(),
          size: input.bytes.byteLength,
          contentType: checked.contentType,
          pathname: `blobs/${id}`,
        };
        await writeCatalog({ ...catalog, files: [file, ...catalog.files] });
        return file;
      });
    } catch (error) {
      await rm(destination, { force: true });
      throw error;
    }
  },

  updateFile(id: string, patch: { name?: string; folder?: string }): Promise<StoredFile> {
    if (!isUuid(id)) return Promise.reject(new HttpError(400, "檔案編號不正確。"));
    return locked(async () => {
      const catalog = await readCatalog();
      const current = catalog.files.find((file) => file.id === id);
      if (!current) throw new HttpError(404, "找不到這個檔案。");
      const name = patch.name ? renameKeepingExtension(current.name, patch.name) : current.name;
      const folder = patch.folder ? requireFolder(catalog, patch.folder) : current.folder;
      if (name === current.name && folder === current.folder) return current;
      const updated = { ...current, name, folder };
      await writeCatalog({
        ...catalog,
        files: catalog.files.map((file) => (file.id === id ? updated : file)),
      });
      return updated;
    });
  },

  removeFile(id: string): Promise<void> {
    if (!isUuid(id)) return Promise.reject(new HttpError(400, "檔案編號不正確。"));
    return locked(async () => {
      const catalog = await readCatalog();
      const current = catalog.files.find((file) => file.id === id);
      if (!current) throw new HttpError(404, "找不到這個檔案。");
      await writeCatalog({ ...catalog, files: catalog.files.filter((file) => file.id !== id) });
      await rm(blobFile(id), { force: true });
    });
  },

  async openFile(id: string, rangeHeader: string | null): Promise<FileBody | null> {
    if (!isUuid(id)) throw new HttpError(400, "檔案編號不正確。");
    const file = await locked(async () => {
      const catalog = await readCatalog();
      return catalog.files.find((item) => item.id === id) ?? null;
    });
    if (!file) return null;
    const fullPath = blobFile(id);
    const info = await stat(fullPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!info) return null;
    const size = info.size;
    if (!rangeHeader) {
      return {
        file,
        stream: Readable.toWeb(createReadStream(fullPath)) as ReadableStream<Uint8Array>,
        status: 200,
        contentLength: size,
      };
    }
    const range = parseByteRange(rangeHeader, size);
    if (range === "unsatisfiable") {
      throw new RangeNotSatisfiableError(size);
    }
    if (!range) {
      return {
        file,
        stream: Readable.toWeb(createReadStream(fullPath)) as ReadableStream<Uint8Array>,
        status: 200,
        contentLength: size,
      };
    }
    const contentLength = range.end - range.start + 1;
    return {
      file,
      stream: Readable.toWeb(createReadStream(fullPath, { start: range.start, end: range.end })) as ReadableStream<Uint8Array>,
      status: 206,
      contentLength,
      contentRange: `bytes ${range.start}-${range.end}/${size}`,
    };
  },
};
