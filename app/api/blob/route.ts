import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse, type NextRequest } from "next/server";
import { ALLOWED_CONTENT_TYPES, VIDEO_MAX_BYTES } from "@/lib/constants";
import { jsonError, requireSession } from "@/lib/http";
import { isUuid } from "@/lib/validate";

export async function POST(request: NextRequest) {
  try {
    await requireSession(request);
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const id = pathname.startsWith("files/") ? pathname.slice("files/".length) : "";
        if (!isUuid(id) || pathname !== `files/${id}`) {
          throw new Error("檔案位置不正確。");
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: VIDEO_MAX_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "檔案位置不正確。") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return jsonError(error);
  }
}
