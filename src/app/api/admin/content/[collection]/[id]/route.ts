import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { deleteManagedMediaObjects } from "@/lib/media-storage";
import { deleteContent, listCollection, listCollectionDocuments, RepositoryError, writeContent } from "@/lib/repository";
import { collectionSchemas, type CollectionName } from "@/lib/schema";
import { assertSameOrigin } from "@/lib/security";

function isCollection(value: string): value is CollectionName {
  return value in collectionSchemas;
}

function expectedVersion(request: Request) {
  const value = request.headers.get("x-content-version") ?? request.headers.get("if-match");
  if (!value) return undefined;
  const parsed = Number(value.replace(/^W\//, "").replaceAll('"', ""));
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new RepositoryError("Invalid content version", 400);
  return parsed;
}

export async function PUT(request: Request, context: { params: Promise<{ collection: string; id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { collection, id } = await context.params;
  if (!isCollection(collection)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  try {
    assertSameOrigin(request);
    const value = await request.json();
    if (collection !== "settings" && String(value.id ?? "") !== id) return NextResponse.json({ error: "Content ID is immutable and must match the request path" }, { status: 409 });
    const version = expectedVersion(request);
    const exists = (await listCollectionDocuments(collection, session)).some((document) => ("id" in document.item ? document.item.id : "site") === id);
    if (exists && version === undefined) throw new RepositoryError("If-Match is required when updating existing content", 428);
    const saved = await writeContent(collection, id, value, session, version);
    return NextResponse.json(saved);
  } catch (error) {
    const status = error instanceof RepositoryError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Write failed" }, { status });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ collection: string; id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { collection, id } = await context.params;
  if (!isCollection(collection)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  try {
    assertSameOrigin(request);
    const version = expectedVersion(request);
    if (version === undefined) throw new RepositoryError("If-Match is required when deleting content", 428);
    const media = collection === "media" ? (await listCollection("media", session)).find((item) => item.id === id) : undefined;
    await deleteContent(collection, id, session, version);
    if (media?.storage) {
      try { await deleteManagedMediaObjects(media); }
      catch (error) {
        await writeContent("media", id, media, session).catch(() => undefined);
        throw new RepositoryError(`Media metadata was restored because object deletion failed: ${error instanceof Error ? error.message : "unknown error"}`, 502);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof RepositoryError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status });
  }
}
