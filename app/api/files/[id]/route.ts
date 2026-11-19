import { NextResponse, type NextRequest } from "next/server";
import { jsonError, requireSession } from "@/lib/http";
import { getStorage } from "@/lib/storage";
import { toPublicFile } from "@/lib/storage/types";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await requireSession(request);
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { name?: unknown; folder?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name : undefined;
    const folder = typeof body?.folder === "string" ? body.folder : undefined;
    if (!name && !folder) {
      return NextResponse.json({ error: "請填新的檔名或資料夾。" }, { status: 400 });
    }
    const file = await getStorage().updateFile(id, { name, folder });
    return NextResponse.json({ file: toPublicFile(file) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    await requireSession(request);
    const { id } = await context.params;
    await getStorage().removeFile(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
