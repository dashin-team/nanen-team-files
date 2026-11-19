import { NextResponse, type NextRequest } from "next/server";
import { RangeNotSatisfiableError } from "@/lib/errors";
import { jsonError, requireSession } from "@/lib/http";
import { getStorage } from "@/lib/storage";
import { contentDisposition } from "@/lib/validate";

export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    await requireSession(request);
    const { id } = await context.params;
    const download = request.nextUrl.searchParams.get("download") === "1";
    const body = await getStorage().openFile(id, request.headers.get("range"));
    if (!body) {
      return NextResponse.json({ error: "找不到這個檔案。" }, { status: 404 });
    }
    const headers = new Headers();
    headers.set("Content-Type", body.file.contentType);
    headers.set("Content-Length", String(body.contentLength));
    headers.set("Accept-Ranges", "bytes");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "private, no-store");
    headers.set("Content-Disposition", contentDisposition(body.file.name, download));
    if (body.contentRange) headers.set("Content-Range", body.contentRange);
    return new NextResponse(body.stream, { status: body.status, headers });
  } catch (error) {
    if (error instanceof RangeNotSatisfiableError) {
      return new NextResponse("無法讀取這一段檔案。", {
        status: 416,
        headers: {
          "Content-Range": `bytes */${error.size}`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return jsonError(error);
  }
}
