import { NextResponse } from "next/server";
import { verifyMediaStorageAccess } from "@/lib/media-storage";
import { getAdminSession } from "@/lib/session";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await verifyMediaStorageAccess();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const storageError = error as Error & { $metadata?: { httpStatusCode?: number } };
    return NextResponse.json({
      ok: false,
      name: storageError.name,
      status: storageError.$metadata?.httpStatusCode ?? null,
      message: storageError.message,
    }, { status: 502 });
  }
}
