import { NextResponse, type NextRequest } from "next/server";
import { ACCEPT, DOCUMENT_MAX_BYTES, VIDEO_MAX_BYTES } from "@/lib/constants";
import { jsonError, requireSession } from "@/lib/http";
import { storageMode } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    await requireSession(request);
    return NextResponse.json({
      authenticated: true,
      storage: storageMode(),
      limits: {
        document: DOCUMENT_MAX_BYTES,
        video: VIDEO_MAX_BYTES,
      },
      accept: ACCEPT,
    });
  } catch (error) {
    return jsonError(error);
  }
}
