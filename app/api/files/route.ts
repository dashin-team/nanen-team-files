import { NextResponse, type NextRequest } from "next/server";
import { jsonError, requireSession } from "@/lib/http";
import { getStorage } from "@/lib/storage";
import { toPublicFile } from "@/lib/storage/types";

export async function GET(request: NextRequest) {
  try {
    await requireSession(request);
    const catalog = await getStorage().list();
    return NextResponse.json({
      folders: catalog.folders,
      files: catalog.files.map(toPublicFile),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession(request);
    const storage = getStorage();
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      if (storage.mode !== "blob") {
        return NextResponse.json({ error: "這個環境請直接上傳檔案。" }, { status: 400 });
      }
      const body = (await request.json()) as {
        id?: unknown;
        name?: unknown;
        folder?: unknown;
        uploader?: unknown;
      };
      if (
        typeof body.id !== "string" ||
        typeof body.name !== "string" ||
        typeof body.folder !== "string" ||
        typeof body.uploader !== "string"
      ) {
        return NextResponse.json({ error: "上傳資料不完整。" }, { status: 400 });
      }
      const file = await storage.registerUploaded({
        id: body.id,
        name: body.name,
        folder: body.folder,
        uploader: body.uploader,
      });
      return NextResponse.json({ file: toPublicFile(file) }, { status: 201 });
    }

    const form = await request.formData();
    const incoming = form.get("file");
    const folder = form.get("folder");
    const uploader = form.get("uploader");
    if (!(incoming instanceof File) || typeof folder !== "string" || typeof uploader !== "string") {
      return NextResponse.json({ error: "請選擇檔案，並填上名字與資料夾。" }, { status: 400 });
    }
    const bytes = new Uint8Array(await incoming.arrayBuffer());
    const file = await storage.addBytes({
      name: incoming.name,
      folder,
      uploader,
      bytes,
    });
    return NextResponse.json({ file: toPublicFile(file) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
