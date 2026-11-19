import { del, get, head, put, BlobNotFoundError, BlobPreconditionFailedError } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { DEFAULT_FOLDERS, MAX_CUSTOM_FOLDERS, blobCatalogPath, blobObjectPath } from "@/lib/constants";
import { HttpError } from "@/lib/errors";
import {
  assertFileAllowed,
  isPrivateBlobUrl,
  isSafeBlobPath,
  isUuid,
  renameKeepingExtension,
  sanitizeFolderName,
  sanitizePersonName,
} from "@/lib/validate";
import { assertFitsQuota } from "@/lib/usage";
import {
  type Catalog,
  type FileBody,
  type StoredFile,
  emptyCatalog,
  normalizeCatalog,
} from "@/lib/storage/types";

const CATALOG_PATH = blobCatalogPath();

function requireFolder(catalog: Catalog, folder: string): string {
  const name = sanitizeFolderName(folder);
  if (!catalog.folders.includes(name)) throw new HttpError(400, "請先選擇資料夾。");
  return name;
}

function isConflict(error: unknown): boolean {
  if (error instanceof BlobPreconditionFailedError) return true;
  const message = error instanceof Error ? error.message : "";
  return /already exists|precondition|conditional/i.test(message);
}

async function readCatalog(): Promise<{ catalog: Catalog; etag?: string }> {
  const result = await get(CATALOG_PATH, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return { catalog: emptyCatalog() };
  try {
    const text = await new Response(result.stream).text();
    return { catalog: normalizeCatalog(JSON.parse(text) as unknown), etag: result.blob.etag };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new HttpError(500, "資料清單讀取失敗，請聯絡管理員。");
    }
    throw error;
  }
}

async function writeCatalog(catalog: Catalog, etag?: string): Promise<void> {
  await put(CATALOG_PATH, JSON.stringify(catalog), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: Boolean(etag),
    cacheControlMaxAge: 60,
    ...(etag ? { ifMatch: etag } : {}),
  });
}

async function updateCatalog(mutate: (catalog: Catalog) => Catalog): Promise<Catalog> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { catalog, etag } = await readCatalog();
    const next = mutate(catalog);
    try {
      await writeCatalog(next, etag);
      return next;
    } catch (error) {
      if (!isConflict(error)) throw error;
      lastError = error;
    }
  }
  console.error(lastError);
  throw new HttpError(503, "同時有人在更新清單，請再試一次。");
}

async function assertPrivateObject(pathname: string): Promise<{ pathname: string; size: number; url: string }> {
  try {
    const info = await head(pathname);
    if (!isPrivateBlobUrl(info.url)) {
      await del(info.url).catch(() => undefined);
      throw new HttpError(400, "儲存庫必須是 Private。請在 Vercel 建立私有的 Blob 後再上傳。");
    }
    return { pathname: info.pathname, size: info.size, url: info.url };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof BlobNotFoundError) {
      throw new HttpError(400, "檔案還沒上傳完成，請再試一次。");
    }
    throw error;
  }
}

async function insertFile(file: StoredFile): Promise<StoredFile> {
  await updateCatalog((catalog) => {
    assertFitsQuota(catalog.files, file.size);
    if (!catalog.folders.includes(file.folder)) throw new HttpError(400, "請先選擇資料夾。");
    if (catalog.files.some((item) => item.id === file.id)) {
      throw new HttpError(409, "這份檔案已經在清單裡。");
    }
    return { ...catalog, files: [file, ...catalog.files] };
  });
  return file;
}

export const blobStorage = {
  mode: "blob" as const,

  async list(): Promise<Catalog> {
    const catalog = (await readCatalog()).catalog;
    return {
      ...catalog,
      files: catalog.files.filter((file) => isSafeBlobPath(file.pathname, file.id)),
    };
  },

  async createFolder(folderName: string): Promise<Catalog> {
    const name = sanitizeFolderName(folderName);
    return updateCatalog((catalog) => {
      if (catalog.folders.includes(name)) throw new HttpError(400, "已經有這個資料夾。");
      const customCount = catalog.folders.filter(
        (folder) => !(DEFAULT_FOLDERS as readonly string[]).includes(folder),
      ).length;
      if (customCount >= MAX_CUSTOM_FOLDERS) {
        throw new HttpError(400, "資料夾太多了，請先用現有的分類。");
      }
      return { ...catalog, folders: [...catalog.folders, name] };
    });
  },

  async deleteFolder(folderName: string): Promise<Catalog> {
    const name = sanitizeFolderName(folderName);
    if ((DEFAULT_FOLDERS as readonly string[]).includes(name)) {
      throw new HttpError(400, "預設資料夾不能刪除。");
    }
    return updateCatalog((catalog) => {
      if (!catalog.folders.includes(name)) throw new HttpError(404, "找不到這個資料夾。");
      if (catalog.files.some((file) => file.folder === name)) {
        throw new HttpError(400, "資料夾裡還有檔案，請先移走或刪除。");
      }
      return { ...catalog, folders: catalog.folders.filter((folder) => folder !== name) };
    });
  },

  async addBytes(input: { name: string; folder: string; uploader: string; bytes: Uint8Array }): Promise<StoredFile> {
    const checked = assertFileAllowed(input.name, input.bytes.byteLength);
    const uploader = sanitizePersonName(input.uploader);
    const id = randomUUID();
    const pathname = blobObjectPath(id);
    const uploaded = await put(pathname, Buffer.from(input.bytes), {
      access: "private",
      contentType: checked.contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    try {
      if (!isPrivateBlobUrl(uploaded.url) || !isSafeBlobPath(uploaded.pathname, id)) {
        throw new HttpError(400, "儲存庫必須是 Private。請在 Vercel 建立私有的 Blob 後再上傳。");
      }
      const folder = requireFolder((await readCatalog()).catalog, input.folder);
      const file: StoredFile = {
        id,
        name: checked.name,
        folder,
        uploader,
        uploadedAt: new Date().toISOString(),
        size: input.bytes.byteLength,
        contentType: checked.contentType,
        pathname: uploaded.pathname,
      };
      return await insertFile(file);
    } catch (error) {
      await del(uploaded.url).catch(() => undefined);
      throw error;
    }
  },

  async registerUploaded(input: { id: string; name: string; folder: string; uploader: string }): Promise<StoredFile> {
    if (!isUuid(input.id)) throw new HttpError(400, "檔案編號不正確。");
    const stored = await assertPrivateObject(blobObjectPath(input.id));
    try {
      if (!isSafeBlobPath(stored.pathname, input.id)) {
        throw new HttpError(400, "檔案位置不正確。");
      }
      const checked = assertFileAllowed(input.name, stored.size);
      const uploader = sanitizePersonName(input.uploader);
      const folder = requireFolder((await readCatalog()).catalog, input.folder);
      const file: StoredFile = {
        id: input.id,
        name: checked.name,
        folder,
        uploader,
        uploadedAt: new Date().toISOString(),
        size: stored.size,
        contentType: checked.contentType,
        pathname: stored.pathname,
      };
      return await insertFile(file);
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 409)) {
        await del(stored.url).catch(() => undefined);
      }
      throw error;
    }
  },

  async updateFile(id: string, patch: { name?: string; folder?: string }): Promise<StoredFile> {
    if (!isUuid(id)) throw new HttpError(400, "檔案編號不正確。");
    let updated: StoredFile | null = null;
    await updateCatalog((catalog) => {
      const current = catalog.files.find((file) => file.id === id);
      if (!current) throw new HttpError(404, "找不到這個檔案。");
      const name = patch.name ? renameKeepingExtension(current.name, patch.name) : current.name;
      const folder = patch.folder ? requireFolder(catalog, patch.folder) : current.folder;
      updated = { ...current, name, folder };
      return { ...catalog, files: catalog.files.map((file) => (file.id === id ? updated! : file)) };
    });
    if (!updated) throw new HttpError(404, "找不到這個檔案。");
    return updated;
  },

  async removeFile(id: string): Promise<void> {
    if (!isUuid(id)) throw new HttpError(400, "檔案編號不正確。");
    let pathname = "";
    await updateCatalog((catalog) => {
      const current = catalog.files.find((file) => file.id === id);
      if (!current) throw new HttpError(404, "找不到這個檔案。");
      pathname = current.pathname;
      return { ...catalog, files: catalog.files.filter((file) => file.id !== id) };
    });
    if (pathname && isSafeBlobPath(pathname, id)) {
      await del(pathname).catch((error) => {
        console.error("刪除雲端檔案失敗", error);
      });
    }
  },

  async openFile(id: string, rangeHeader: string | null): Promise<FileBody | null> {
    void rangeHeader;
    if (!isUuid(id)) throw new HttpError(400, "檔案編號不正確。");
    const catalog = (await readCatalog()).catalog;
    const file = catalog.files.find((item) => item.id === id);
    if (!file || !isSafeBlobPath(file.pathname, id)) return null;
    const result = await get(file.pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return {
      file,
      stream: result.stream,
      status: 200,
      contentLength: result.blob.size ?? file.size,
    };
  },
};
