import { NextResponse } from "next/server";
import { verifyMediaStorageAccess } from "@/lib/media-storage";

export async function GET() {
  try {
    await verifyMediaStorageAccess();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const storageError = error as Error & { $metadata?: { httpStatusCode?: number } };
    return NextResponse.json({
      ok: false,
      name: storageError.name,
      status: storageError.$metadata?.httpStatusCode ?? null,
    }, { status: 502 });
  }
}
