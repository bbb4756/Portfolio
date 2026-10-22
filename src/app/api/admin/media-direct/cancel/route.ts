import { NextResponse } from "next/server";
import { deleteObject, readUploadTicket } from "@/lib/media-storage";
import { RepositoryError } from "@/lib/repository";
import { assertSameOrigin } from "@/lib/security";
import { getAdminSession } from "@/lib/session";

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    assertSameOrigin(request);
    const input = await request.json() as { uploadToken?: string };
    const ticket = readUploadTicket(String(input.uploadToken ?? ""));
    await deleteObject(ticket.pendingKey);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof RepositoryError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not cancel upload" }, { status });
  }
}
