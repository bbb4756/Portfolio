import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { CollectionName } from "./schema";

export type StoredDocument<T = Record<string, unknown>> = {
  item: T;
  version: number;
};

type DocumentRow = {
  payload: Record<string, unknown>;
  version: number | string;
};

let client: NeonQueryFunction<false, false> | null = null;

export class DocumentConflictError extends Error {}
export class DocumentNotFoundError extends Error {}

function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required for the PostgreSQL content adapter");
  return value;
}

function environment() {
  const value = process.env.CMS_ENVIRONMENT;
  if (value === "preview" || value === "production") return value;
  if (process.env.NODE_ENV !== "production") return "preview";
  throw new Error("CMS_ENVIRONMENT must be preview or production");
}

function sql() {
  if (!client) client = neon(databaseUrl());
  return client;
}

function rowVersion(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function metadata(value: Record<string, unknown>) {
  return {
    slug: typeof value.slug === "string" && value.slug ? value.slug : null,
    status: typeof value.status === "string" && value.status ? value.status : null,
    order: typeof value.order === "number" && Number.isFinite(value.order) ? value.order : 0,
  };
}

export async function listDocuments<T extends Record<string, unknown>>(collection: CollectionName): Promise<Array<StoredDocument<T>>> {
  const rows = await sql().query(
    `SELECT payload, version
       FROM cms_documents
      WHERE environment = $1 AND collection = $2
      ORDER BY sort_order ASC, id ASC`,
    [environment(), collection],
  ) as DocumentRow[];
  return rows.map((row) => ({ item: row.payload as T, version: rowVersion(row.version) }));
}

export async function getDocumentVersion(collection: CollectionName, id: string) {
  const rows = await sql().query(
    `SELECT version
       FROM cms_documents
      WHERE environment = $1 AND collection = $2 AND id = $3`,
    [environment(), collection, id],
  ) as Array<Pick<DocumentRow, "version">>;
  return rows[0] ? rowVersion(rows[0].version) : null;
}

export async function putDocument<T extends Record<string, unknown>>(
  collection: CollectionName,
  id: string,
  item: T,
  expectedVersion?: number,
): Promise<StoredDocument<T>> {
  const meta = metadata(item);
  try {
    const parameters = [environment(), collection, id, JSON.stringify(item), meta.slug, meta.status, meta.order];
    const rows = expectedVersion === undefined
      ? await sql().query(
        `INSERT INTO cms_documents (
           environment, collection, id, payload, slug, status, sort_order
         ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
         RETURNING payload, version`,
        parameters,
      ) as DocumentRow[]
      : await sql().query(
        `UPDATE cms_documents SET
           payload = $4::jsonb,
           slug = $5,
           status = $6,
           sort_order = $7,
           version = version + 1,
           updated_at = clock_timestamp()
         WHERE environment = $1 AND collection = $2 AND id = $3 AND version = $8
         RETURNING payload, version`,
        [...parameters, expectedVersion],
      ) as DocumentRow[];
    if (!rows[0]) throw new DocumentConflictError("Content changed after it was loaded. Reload before saving again.");
    return { item: rows[0].payload as T, version: rowVersion(rows[0].version) };
  } catch (error) {
    if (error instanceof DocumentConflictError) throw error;
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      const constraint = "constraint" in error ? String(error.constraint ?? "") : "";
      throw new DocumentConflictError(
        constraint.includes("slug")
          ? "Another record already uses this slug."
          : "Another record already uses this content ID.",
      );
    }
    throw error;
  }
}

export async function removeDocument(collection: CollectionName, id: string, expectedVersion?: number) {
  const rows = await sql().query(
    `DELETE FROM cms_documents
      WHERE environment = $1
        AND collection = $2
        AND id = $3
        AND ($4::bigint IS NULL OR version = $4::bigint)
      RETURNING version`,
    [environment(), collection, id, expectedVersion ?? null],
  ) as Array<Pick<DocumentRow, "version">>;
  if (rows[0]) return;
  const current = await getDocumentVersion(collection, id);
  if (current === null) throw new DocumentNotFoundError("Content was not found.");
  throw new DocumentConflictError("Content changed after it was loaded. Reload before deleting it.");
}
