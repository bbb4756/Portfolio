import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { listCollectionDocuments, RepositoryError, writeContent } from "@/lib/repository";
import { collectionSchemas, type CollectionName } from "@/lib/schema";
import { assertSameOrigin } from "@/lib/security";

function isCollection(value: string): value is CollectionName {
  return value in collectionSchemas;
}

export async function GET(_: Request, context: { params: Promise<{ collection: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { collection } = await context.params;
  if (!isCollection(collection)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  try {
    const documents = await listCollectionDocuments(collection, session);
    return NextResponse.json({
      items: documents.map((document) => document.item),
      versions: Object.fromEntries(documents.map((document) => ["id" in document.item ? String(document.item.id) : "site", document.version])),
    });
  } catch (error) {
    const status = error instanceof RepositoryError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Read failed" }, { status });
  }
}

export async function POST(request: Request, context: { params: Promise<{ collection: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { collection } = await context.params;
  if (!isCollection(collection)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  try {
    assertSameOrigin(request);
    const value = await request.json();
    const id = collection === "settings" ? "site" : String(value.id ?? "");
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });
    const saved = await writeContent(collection, id, value, session);
    return NextResponse.json(saved);
  } catch (error) {
    const status = error instanceof RepositoryError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Write failed" }, { status });
  }
}
