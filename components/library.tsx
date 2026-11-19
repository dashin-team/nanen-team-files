"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, FolderPlus, LogOut, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { BrandBanner, BrandLogo } from "@/components/brand";
import { FileGlyph, PreviewDialog } from "@/components/preview-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DEFAULT_FOLDERS, NAME_STORAGE_KEY, canPreview, typeLabel } from "@/lib/constants";
import { formatSize, formatWhen } from "@/lib/format";
import type { PublicFile } from "@/lib/storage/types";
import { readJson, uploadBlob, uploadLocal } from "@/lib/transfer";
import { sanitizePersonName } from "@/lib/validate";

type StorageMode = "blob" | "local" | "unconfigured";
type SortOrder = "newest" | "oldest";

const ALL = "全部";

async function loadLibrary() {
  const [sessionResponse, filesResponse] = await Promise.all([
    fetch("/api/session"),
    fetch("/api/files"),
  ]);
  if (sessionResponse.status === 401 || filesResponse.status === 401) {
    return null;
  }
  const session = await readJson<{
    storage: StorageMode;
    limits: { document: number; video: number };
    accept: string;
  }>(sessionResponse);
  const library = await readJson<{ folders: string[]; files: PublicFile[] }>(filesResponse);
  return { session, library };
}

export function Library() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploader, setUploader] = useState("");
  const [folders, setFolders] = useState<string[]>([...DEFAULT_FOLDERS]);
  const [files, setFiles] = useState<PublicFile[]>([]);
  const [storage, setStorage] = useState<StorageMode>("local");
  const [accept, setAccept] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [folder, setFolder] = useState(ALL);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [preview, setPreview] = useState<PublicFile | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadFolder, setUploadFolder] = useState<string>(DEFAULT_FOLDERS[0]);
  const [progress, setProgress] = useState<number | null>(null);
  const [renameTarget, setRenameTarget] = useState<PublicFile | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameFolder, setRenameFolder] = useState<string>(DEFAULT_FOLDERS[0]);
  const [deleteTarget, setDeleteTarget] = useState<PublicFile | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const result = await loadLibrary();
    if (!result) return null;
    setStorage(result.session.storage);
    setAccept(result.session.accept);
    setFolders(result.library.folders);
    setFiles(result.library.files);
    return result;
  }

  useEffect(() => {
    const saved = window.localStorage.getItem(NAME_STORAGE_KEY) ?? "";
    let cancelled = false;
    void (async () => {
      try {
        const result = await loadLibrary();
        if (cancelled) return;
        if (!result) {
          router.replace("/login");
          return;
        }
        setStorage(result.session.storage);
        setAccept(result.session.accept);
        setFolders(result.library.folders);
        setFiles(result.library.files);
        if (saved) setUploader(saved);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "讀取檔案清單失敗。");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function rememberName(value: string) {
    setUploader(value);
    const trimmed = value.trim();
    if (trimmed) window.localStorage.setItem(NAME_STORAGE_KEY, trimmed);
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-TW");
    return files
      .filter((file) => (folder === ALL ? true : file.folder === folder))
      .filter((file) => (needle ? file.name.toLocaleLowerCase("zh-TW").includes(needle) : true))
      .sort((left, right) => {
        const delta = new Date(left.uploadedAt).getTime() - new Date(right.uploadedAt).getTime();
        if (delta === 0) return left.name.localeCompare(right.name, "zh-TW");
        return sort === "newest" ? -delta : delta;
      });
  }, [files, folder, query, sort]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const file of files) map.set(file.folder, (map.get(file.folder) ?? 0) + 1);
    return map;
  }, [files]);

  function chooseUpload(file: File | null) {
    if (!file) return;
    setPendingFile(file);
    setProgress(null);
    setUploadFolder(folder === ALL ? folders[0] ?? DEFAULT_FOLDERS[0] : folder);
  }

  async function submitUpload(event: FormEvent) {
    event.preventDefault();
    if (!pendingFile || storage === "unconfigured") return;
    let name = "";
    try {
      name = sanitizePersonName(uploader);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "請先填上您的名字。");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const saved =
        storage === "blob"
          ? await uploadBlob(pendingFile, uploadFolder, name, setProgress)
          : await uploadLocal(pendingFile, uploadFolder, name, setProgress);
      toast.success(`已上傳「${saved.name}」`);
      setPendingFile(null);
      setFolder(saved.folder);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上傳失敗。");
    } finally {
      setBusy(false);
      setProgress(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function submitRename(event: FormEvent) {
    event.preventDefault();
    if (!renameTarget) return;
    setBusy(true);
    try {
      await readJson(
        await fetch(`/api/files/${renameTarget.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: renameName, folder: renameFolder }),
        }),
      );
      toast.success("已更新檔案");
      setRenameTarget(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "沒有更新成功。");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await readJson(await fetch(`/api/files/${deleteTarget.id}`, { method: "DELETE" }));
      toast.success("已刪除");
      setDeleteTarget(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "沒有刪除成功。");
    } finally {
      setBusy(false);
    }
  }

  async function submitFolder(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await readJson<{ folders: string[] }>(
        await fetch("/api/folders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: folderName }),
        }),
      );
      setFolders(data.folders);
      setFolder(folderName.trim());
      setFolderName("");
      setFolderOpen(false);
      toast.success("已新增資料夾");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "沒有新增成功。");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteFolder() {
    if (folder === ALL) return;
    setBusy(true);
    try {
      const data = await readJson<{ folders: string[] }>(
        await fetch("/api/folders", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: folder }),
        }),
      );
      setFolders(data.folders);
      setFolder(ALL);
      setDeleteFolderOpen(false);
      toast.success("已刪除資料夾");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "沒有刪除成功。");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  const customEmpty =
    folder !== ALL && !(DEFAULT_FOLDERS as readonly string[]).includes(folder) && (counts.get(folder) ?? 0) === 0;

  return (
    <div className="min-h-dvh">
      <header className="bg-primary">
        <BrandBanner />
        <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <BrandLogo className="size-10" />
            <h1 className="min-w-0 flex-1 font-brand text-lg leading-tight text-primary">團隊檔案庫</h1>
            <Button type="button" variant="outline" className="h-11 px-3 text-base" onClick={logout}>
              <LogOut className="size-4" />
              登出
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 md:pb-16">
        <label className="block">
          <span className="text-sm font-medium">您的名字</span>
          <Input
            value={uploader}
            onChange={(event) => rememberName(event.target.value)}
            maxLength={20}
            placeholder="例如：林夥伴"
            autoComplete="name"
            className="mt-2 h-12 bg-card px-3 text-base"
          />
          <span className="mt-1 block text-xs text-muted-foreground">會顯示在檔案上，也會記在這支手機裡。</span>
        </label>

        {storage === "local" ? (
          <p className="mt-4 rounded-2xl bg-gold-soft px-4 py-3 text-sm leading-6 text-foreground">
            現在是本機練習模式，檔案存在這台電腦的 .data 資料夾。上線前要接上 Vercel Blob，檔案才會一直留著。
          </p>
        ) : null}
        {storage === "unconfigured" ? (
          <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
            雲端儲存還沒接上，暫時不能上傳。請管理員在 Vercel 建立 Private Blob，並設定 BLOB_READ_WRITE_TOKEN。
          </p>
        ) : null}
        {storage === "blob" ? (
          <p className="mt-4 text-sm text-muted-foreground">檔案放在私人雲端，只有知道密碼的夥伴能打開。</p>
        ) : null}

        <div className="mt-6 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-8">
          <aside>
            <div className="flex items-center justify-between md:mb-3">
              <h2 className="text-sm font-medium">資料夾</h2>
              <Button type="button" variant="ghost" className="h-10 px-2" onClick={() => setFolderOpen(true)}>
                <FolderPlus className="size-4" />
                新增
              </Button>
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
              <FolderChip
                label={ALL}
                count={files.length}
                active={folder === ALL}
                onClick={() => setFolder(ALL)}
              />
              {folders.map((name) => (
                <FolderChip
                  key={name}
                  label={name}
                  count={counts.get(name) ?? 0}
                  active={folder === name}
                  onClick={() => setFolder(name)}
                />
              ))}
            </div>
            {customEmpty ? (
              <Button
                type="button"
                variant="ghost"
                className="mt-2 h-10 px-2 text-destructive"
                onClick={() => setDeleteFolderOpen(true)}
              >
                <Trash2 className="size-4" />
                刪除這個空資料夾
              </Button>
            ) : null}
          </aside>

          <section
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              chooseUpload(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <div className="mt-5 flex gap-2 md:mt-0">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜尋檔名"
                  aria-label="搜尋檔名"
                  className="h-12 bg-card pr-3 pl-9 text-base"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 shrink-0 bg-card px-3 text-base"
                onClick={() => setSort((value) => (value === "newest" ? "oldest" : "newest"))}
              >
                {sort === "newest" ? "最新" : "最舊"}
              </Button>
            </div>

            <div className="mt-4">
              {loading ? (
                <div className="space-y-3" aria-busy="true">
                  <div className="h-24 animate-pulse rounded-2xl bg-secondary" />
                  <div className="h-24 animate-pulse rounded-2xl bg-secondary" />
                </div>
              ) : null}
              {loadError ? (
                <div className="rounded-2xl bg-card px-4 py-6 ring-1 ring-border">
                  <p className="text-sm">{loadError}</p>
                  <Button
                    type="button"
                    className="mt-4 h-11"
                    onClick={() => {
                      setLoading(true);
                      setLoadError(null);
                      refresh()
                        .catch((error: unknown) => {
                          setLoadError(error instanceof Error ? error.message : "讀取檔案清單失敗。");
                        })
                        .finally(() => setLoading(false));
                    }}
                  >
                    再試一次
                  </Button>
                </div>
              ) : null}
              {!loading && !loadError && visible.length === 0 ? (
                <div className="rounded-[1.5rem] bg-card px-5 py-10 text-center ring-1 ring-border">
                  <p className="font-heading text-xl">
                    {query.trim() ? `找不到「${query.trim()}」` : "這個資料夾還沒有檔案"}
                  </p>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                    {query.trim()
                      ? "換個關鍵字，或清掉搜尋看看其他檔案。"
                      : "商品 DM、教育講義、表單或行銷圖，都可以從下方上傳。"}
                  </p>
                </div>
              ) : null}
              {!loading && !loadError && visible.length > 0 ? (
                <ul className="divide-y divide-border overflow-hidden rounded-[1.5rem] bg-card ring-1 ring-border">
                  {visible.map((file) => (
                    <li key={file.id} className="px-4 py-4">
                      <div className="flex gap-3">
                        <FileGlyph extension={file.extension} />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base leading-snug font-medium break-all">{file.name}</h3>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {typeLabel(file.extension)} · {file.uploader} · {formatWhen(file.uploadedAt)} ·{" "}
                            {formatSize(file.size)}
                            {folder === ALL ? ` · ${file.folder}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
                        {canPreview(file.extension) ? (
                          <Button type="button" variant="outline" className="h-11 bg-background" onClick={() => setPreview(file)}>
                            <Eye className="size-4" />
                            預覽
                          </Button>
                        ) : null}
                        <a
                          href={`/api/files/${file.id}/content?download=1`}
                          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium"
                        >
                          <Download className="size-4" />
                          下載
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-11"
                          onClick={() => {
                            setRenameTarget(file);
                            setRenameName(file.name);
                            setRenameFolder(file.folder);
                          }}
                        >
                          <Pencil className="size-4" />
                          重新命名
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-11 text-destructive"
                          onClick={() => setDeleteTarget(file)}
                        >
                          <Trash2 className="size-4" />
                          刪除
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="mx-auto w-full max-w-6xl">
          <Button
            type="button"
            className="h-12 w-full text-base"
            disabled={storage === "unconfigured"}
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="size-4" />
            上傳檔案
          </Button>
        </div>
      </div>
      <div className="mx-auto hidden w-full max-w-6xl px-4 pb-10 md:block">
        <Button
          type="button"
          className="h-12 px-5 text-base"
          disabled={storage === "unconfigured"}
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="size-4" />
          上傳檔案
        </Button>
        <p className="mt-3 max-w-xl text-xs leading-5 text-muted-foreground">
          文件與圖片上限 40 MB，影片上限 100 MB。支援 PDF、JPG、PNG、HEIC、Word、Excel、PowerPoint、MP4。
        </p>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => chooseUpload(event.target.files?.[0] ?? null)}
      />

      <Dialog
        open={pendingFile !== null}
        disablePointerDismissal={busy}
        onOpenChange={(open, details) => {
          if (!open && busy) {
            details.cancel();
            return;
          }
          if (!open) setPendingFile(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上傳到文件庫</DialogTitle>
            <DialogDescription className="break-all">{pendingFile?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitUpload} className="grid gap-3">
            <label className="text-sm font-medium" htmlFor="upload-folder">
              放到哪個資料夾
            </label>
            <select
              id="upload-folder"
              value={uploadFolder}
              onChange={(event) => setUploadFolder(event.target.value)}
              className="h-12 rounded-lg border border-input bg-card px-3 text-base"
            >
              {folders.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <p className="text-xs leading-5 text-muted-foreground">
              {pendingFile ? formatSize(pendingFile.size) : ""} · 上傳者 {uploader.trim() || "（請先填名字）"}
            </p>
            {progress !== null ? (
              <div className="h-2 overflow-hidden rounded-full bg-secondary" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} role="progressbar">
                <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => setPendingFile(null)}>
                取消
              </Button>
              <Button type="submit" className="h-11" disabled={busy}>
                {busy ? "上傳中…" : "確認上傳"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && !busy && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重新命名</DialogTitle>
            <DialogDescription>確認後，檔名和所在資料夾會一起更新。</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRename} className="grid gap-3">
            <label htmlFor="rename-name" className="text-sm font-medium">
              檔名
            </label>
            <Input
              id="rename-name"
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              className="h-12 px-3 text-base"
              required
            />
            <label htmlFor="rename-folder" className="text-sm font-medium">
              資料夾
            </label>
            <select
              id="rename-folder"
              value={renameFolder}
              onChange={(event) => setRenameFolder(event.target.value)}
              className="h-12 rounded-lg border border-input bg-card px-3 text-base"
            >
              {folders.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => setRenameTarget(null)}>
                取消
              </Button>
              <Button type="submit" className="h-11" disabled={busy}>
                確認重新命名
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={folderOpen} onOpenChange={(open) => !busy && setFolderOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增資料夾</DialogTitle>
            <DialogDescription>例如：競賽辦法、客戶感謝信。16 個字以內。</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitFolder} className="grid gap-3">
            <Input
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              maxLength={16}
              placeholder="資料夾名稱"
              aria-label="資料夾名稱"
              className="h-12 px-3 text-base"
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => setFolderOpen(false)}>
                取消
              </Button>
              <Button type="submit" className="h-11" disabled={busy}>
                <Plus className="size-4" />
                建立
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && !busy && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除這個檔案？</AlertDialogTitle>
            <AlertDialogDescription className="break-all">
              「{deleteTarget?.name}」刪除後無法復原，團隊裡的人都會看不到。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteFolderOpen} onOpenChange={(open) => !busy && setDeleteFolderOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除資料夾「{folder}」？</AlertDialogTitle>
            <AlertDialogDescription>這個資料夾是空的，刪掉不會影響檔案。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={confirmDeleteFolder}>
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PreviewDialog file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function FolderChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm md:w-full md:justify-between md:rounded-2xl ${
        active ? "bg-primary text-primary-foreground" : "bg-card text-foreground ring-1 ring-border"
      }`}
    >
      <span>{label}</span>
      <span className={active ? "text-primary-foreground/80" : "text-muted-foreground"}>{count}</span>
    </button>
  );
}
