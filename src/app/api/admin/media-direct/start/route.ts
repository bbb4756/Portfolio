import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { allowedMediaTypes, createDirectUpload, createUploadTicket, mediaMaxBytes, mediaObjectKey, readUploadTicket } from "@/lib/media-storage";
import { RepositoryError } from "@/lib/repository";
import { assertSameOrigin } from "@/lib/security";
import { getAdminSession } from "@/lib/session";

function safeName(value: string) {
  const normalized = value.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return normalized.slice(-100) || "media";
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    assertSameOrigin(request);
    const input = await request.json() as Record<string, unknown>;
    const fileName = String(input.fileName ?? "");
    const contentType = String(input.contentType ?? "");
    const size = Number(input.size ?? 0);
    const alt = String(input.alt ?? "").trim();
    const replaceId = String(input.replaceId ?? "").trim() || undefined;
    const expectedVersion = input.expectedVersion === undefined ? undefined : Number(input.expectedVersion);
    if (!fileName) throw new RepositoryError("File name is required", 400);
    if (!allowedMediaTypes.has(contentType)) throw new RepositoryError(`Unsupported file type: ${contentType || "unknown"}`, 415);
    if (!Number.isSafeInteger(size) || size <= 0) throw new RepositoryError("File size is invalid", 400);
    if (size > mediaMaxBytes()) throw new RepositoryError(`File exceeds the configured ${(mediaMaxBytes() / 1024 / 1024).toFixed(0)} MB direct-upload limit`, 413);
    if (!alt) throw new RepositoryError("Alt text is required", 422);
    if (replaceId && (!Number.isSafeInteger(expectedVersion) || Number(expectedVersion) < 1)) throw new RepositoryError("A valid content version is required when replacing media", 428);
    const id = replaceId ?? crypto.randomUUID();
    const leaf = `${id}-${safeName(fileName)}`;
    const ticketToken = createUploadTicket({
      id,
      pendingKey: mediaObjectKey("pending", leaf),
      finalKey: mediaObjectKey("media", leaf),
      fileName,
      contentType,
      size,
      title: String(input.title ?? "").trim() || fileName,
      alt,
      width: Math.max(0, Number(input.width ?? 0) || 0),
      height: Math.max(0, Number(input.height ?? 0) || 0),
      replaceId,
      expectedVersion,
    });
    const ticket = readUploadTicket(ticketToken);
    const direct = await createDirectUpload(ticket);
    return NextResponse.json({ ...direct, uploadToken: ticketToken, expiresAt: ticket.expiresAt, maxBytes: mediaMaxBytes() });
  } catch (error) {
    const status = error instanceof RepositoryError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start upload" }, { status });
  }
}
