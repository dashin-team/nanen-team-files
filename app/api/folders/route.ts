import { NextResponse, type NextRequest } from "next/server";
import { jsonError, requireSession } from "@/lib/http";
import { getStorage } from "@/lib/storage";

async function readName(request: NextRequest): Promise<string> {
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  if (typeof body?.name !== "string") {
    throw new Error("請填資料夾名稱。");
  }
  return body.name;
}

export async function POST(request: NextRequest) {
  try {
    await requireSession(request);
    const name = await readName(request).catch(() => "");
    if (!name) return NextResponse.json({ error: "請填資料夾名稱。" }, { status: 400 });
    const catalog = await getStorage().createFolder(name);
    return NextResponse.json({ folders: catalog.folders }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireSession(request);
    const name = await readName(request).catch(() => "");
    if (!name) return NextResponse.json({ error: "請指定資料夾。" }, { status: 400 });
    const catalog = await getStorage().deleteFolder(name);
    return NextResponse.json({ folders: catalog.folders });
  } catch (error) {
    return jsonError(error);
  }
}
