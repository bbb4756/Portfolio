import { NextResponse } from "next/server";
import { deleteObject, finalizeUploadedObject, readUploadTicket, validateUploadedObject } from "@/lib/media-storage";
import { listCollection, RepositoryError, writeContent } from "@/lib/repository";
import { mediaSchema } from "@/lib/schema";
import { assertSameOrigin } from "@/lib/security";
import { getAdminSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let finalKey = "";
  try {
    assertSameOrigin(request);
    const input = await request.json() as { uploadToken?: string };
    const ticket = readUploadTicket(String(input.uploadToken ?? ""));
    const current = ticket.replaceId ? (await listCollection("media", session)).find((item) => item.id === ticket.replaceId) : undefined;
    if (ticket.replaceId && !current) throw new RepositoryError("Media to replace was not found", 404);
    await validateUploadedObject(ticket);
    const stored = await finalizeUploadedObject(ticket);
    finalKey = stored.storage.key;
    const kind = ticket.contentType === "image/gif" ? "gif" : ticket.contentType.startsWith("video/") ? "video" : "image";
    const candidate = current ? {
      ...current,
      title: ticket.title,
      alt: ticket.alt,
      kind,
      file: stored.file,
      originalWidth: ticket.width,
      originalHeight: ticket.height,
      aspectRatio: ticket.width && ticket.height ? `${ticket.width}/${ticket.height}` : "",
      fileSize: ticket.size,
      history: [...(current.history ?? []), current.file],
      storage: stored.storage,
      storageHistory: [...(current.storageHistory ?? []), ...(current.storage ? [current.storage] : [])],
    } : {
      id: ticket.id,
      title: ticket.title,
      description: "",
      alt: ticket.alt,
      kind,
      file: stored.file,
      poster: "",
      originalWidth: ticket.width,
      originalHeight: ticket.height,
      aspectRatio: ticket.width && ticket.height ? `${ticket.width}/${ticket.height}` : "",
      fileSize: ticket.size,
      order: Date.now(),
      featured: false,
      autoplay: false,
      loop: true,
      muted: true,
      showOnMobile: true,
      showOnDesktop: true,
      history: [],
      storage: stored.storage,
      storageHistory: [],
    };
    const parsed = mediaSchema.safeParse(candidate);
    if (!parsed.success) throw new RepositoryError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "), 422);
    const saved = await writeContent("media", ticket.id, parsed.data, session, ticket.expectedVersion);
    return NextResponse.json(saved);
  } catch (error) {
    if (finalKey) await deleteObject(finalKey).catch(() => undefined);
    const status = error instanceof RepositoryError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not complete upload" }, { status });
  }
}
