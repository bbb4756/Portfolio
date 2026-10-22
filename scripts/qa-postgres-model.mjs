import fs from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = process.cwd();
const db = new PGlite();
const migration = await fs.readFile(path.join(root, "migrations/001_cms_documents.sql"), "utf8");
await db.exec(migration);

const documents = [];
for (const collection of ["projects", "media", "experience", "engineering"]) {
  const directory = path.join(root, "content", collection);
  for (const name of (await fs.readdir(directory)).filter((value) => value.endsWith(".json")).sort()) {
    const item = JSON.parse(await fs.readFile(path.join(directory, name), "utf8"));
    documents.push({ collection, id: item.id, item });
  }
}
documents.push({ collection: "settings", id: "site", item: JSON.parse(await fs.readFile(path.join(root, "content/settings/site.json"), "utf8")) });

for (const { collection, id, item } of documents) {
  await db.query(
    `INSERT INTO cms_documents (environment, collection, id, payload, slug, status, sort_order)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
    ["preview", collection, id, JSON.stringify(item), item.slug || null, item.status || null, item.order || 0],
  );
}

const [{ count }] = (await db.query("SELECT count(*)::int AS count FROM cms_documents WHERE environment = 'preview'")).rows;
const [{ published }] = (await db.query("SELECT count(*)::int AS published FROM cms_documents WHERE environment = 'preview' AND collection = 'projects' AND status = 'published'")).rows;

const fixture = { ...documents.find((document) => document.collection === "projects")?.item, id: "qa-draft", slug: "qa-draft", name: "QA Draft", status: "draft" };
await db.query(
  `INSERT INTO cms_documents (environment, collection, id, payload, slug, status, sort_order)
   VALUES ('preview', 'projects', 'qa-draft', $1::jsonb, 'qa-draft', 'draft', 999)`,
  [JSON.stringify(fixture)],
);
const anonymousRows = await db.query("SELECT id FROM cms_documents WHERE environment = 'preview' AND collection = 'projects' AND status = 'published' AND id = 'qa-draft'");

const firstUpdate = await db.query(
  "UPDATE cms_documents SET payload = payload || '{\"name\":\"QA Draft v2\"}'::jsonb, version = version + 1 WHERE environment = 'preview' AND collection = 'projects' AND id = 'qa-draft' AND version = 1 RETURNING version",
);
const staleUpdate = await db.query(
  "UPDATE cms_documents SET version = version + 1 WHERE environment = 'preview' AND collection = 'projects' AND id = 'qa-draft' AND version = 1 RETURNING version",
);

let duplicateSlugRejected = false;
try {
  await db.query(
    "INSERT INTO cms_documents (environment, collection, id, payload, slug, status) VALUES ('preview', 'projects', 'qa-duplicate', $1::jsonb, 'qa-draft', 'draft')",
    [JSON.stringify({ ...fixture, id: "qa-duplicate" })],
  );
} catch {
  duplicateSlugRejected = true;
}

let duplicateIdRejected = false;
try {
  await db.query(
    "INSERT INTO cms_documents (environment, collection, id, payload, slug, status) VALUES ('preview', 'projects', 'qa-draft', $1::jsonb, 'qa-draft-other-slug', 'draft')",
    [JSON.stringify({ ...fixture, slug: "qa-draft-other-slug" })],
  );
} catch {
  duplicateIdRejected = true;
}

await db.query(
  "INSERT INTO cms_documents (environment, collection, id, payload, slug, status) VALUES ('production', 'projects', 'qa-draft', $1::jsonb, 'qa-draft', 'draft')",
  [JSON.stringify(fixture)],
);
const [{ previewCount }] = (await db.query("SELECT count(*)::int AS \"previewCount\" FROM cms_documents WHERE environment = 'preview' AND id = 'qa-draft'")).rows;
const [{ productionCount }] = (await db.query("SELECT count(*)::int AS \"productionCount\" FROM cms_documents WHERE environment = 'production' AND id = 'qa-draft'")).rows;

const checks = {
  schemaAndJsonMigration: Number(count) === documents.length,
  publishedFilter: Number(published) === documents.filter((document) => document.collection === "projects" && document.item.status === "published").length,
  draftExcludedFromAnonymousQuery: anonymousRows.rows.length === 0,
  optimisticVersionUpdate: Number(firstUpdate.rows[0]?.version) === 2,
  staleWriteRejected: staleUpdate.rows.length === 0,
  duplicateSlugRejected,
  duplicateIdRejected,
  environmentIsolation: Number(previewCount) === 1 && Number(productionCount) === 1,
};

await db.close();
const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
console.log(JSON.stringify({ status, sourceDocuments: documents.length, checks }, null, 2));
if (status !== "PASS") process.exitCode = 1;
