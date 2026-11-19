"use client";

import { Download, FileText, Image as ImageIcon, Presentation, Sheet, Clapperboard, File } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { previewKind, typeLabel } from "@/lib/constants";
import type { PublicFile } from "@/lib/storage/types";

export function FileGlyph({ extension }: { extension: string }) {
  const className = "size-5";
  const kind = previewKind(extension);
  let icon = <File className={className} aria-hidden />;
  if (kind === "image" || extension === "heic" || extension === "heif") {
    icon = <ImageIcon className={className} aria-hidden />;
  } else if (kind === "pdf" || extension === "doc" || extension === "docx") {
    icon = <FileText className={className} aria-hidden />;
  } else if (kind === "video") {
    icon = <Clapperboard className={className} aria-hidden />;
  } else if (extension === "xls" || extension === "xlsx" || extension === "csv") {
    icon = <Sheet className={className} aria-hidden />;
  } else if (extension === "ppt" || extension === "pptx") {
    icon = <Presentation className={className} aria-hidden />;
  }
  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gold-soft text-primary">
      {icon}
    </div>
  );
}

export function PreviewDialog({
  file,
  onClose,
}: {
  file: PublicFile | null;
  onClose: () => void;
}) {
  const kind = file ? previewKind(file.extension) : "none";
  const src = file ? `/api/files/${file.id}/content` : "";
  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl" showCloseButton>
        <DialogHeader>
          <DialogTitle className="pr-8 break-all">{file?.name}</DialogTitle>
          <DialogDescription>
            {file ? `${typeLabel(file.extension)} · ${file.uploader}` : ""}
          </DialogDescription>
        </DialogHeader>
        {file && kind === "image" ? (
          // Authenticated same-origin file. next/image cannot attach the session cookie to an optimizer request.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={file.name} className="max-h-[70dvh] w-full rounded-xl bg-secondary object-contain" />
        ) : null}
        {file && kind === "pdf" ? (
          <iframe title={file.name} src={src} className="h-[70dvh] w-full rounded-xl bg-white" />
        ) : null}
        {file && kind === "video" ? (
          <video src={src} controls playsInline className="max-h-[70dvh] w-full rounded-xl bg-black" />
        ) : null}
        {file ? (
          <a
            href={`${src}?download=1`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground"
          >
            <Download className="size-4" />
            下載
          </a>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
