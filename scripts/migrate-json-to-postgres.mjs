import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { neon } from "@neondatabase/serverless";

const root = process.cwd();
const apply = process.argv.includes("--apply");
const allowExisting = process.argv.includes("--allow-existing");
const collections = ["projects", "media", "experience", "engineering"];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, stable(child)]));
  return value;
}

async function readDocuments() {
  const documents = [];
  for (const collection of collections) {
    const directory = path.join(root, "content", collection);
    const names = (await fs.readdir(directory)).filter((name) => name.endsWith(".json")).sort();
    for (const name of names) {
      const item = JSON.parse(await fs.readFile(path.join(directory, name), "utf8"));
      const id = String(item.id ?? "");
      if (!id || `${id}.json` !== name) throw new Error(`${collection}/${name} has a missing or mismatched id`);
      documents.push({ collection, id, item });
    }
  }
  const settings = JSON.parse(await fs.readFile(path.join(root, "content/settings/site.json"), "utf8"));
  documents.push({ collection: "settings", id: "site", item: settings });
  const keys = documents.map(({ collection, id }) => `${collection}/${id}`);
  if (new Set(keys).size !== keys.length) throw new Error("Duplicate collection/id pair in JSON source");
  return documents;
}

const documents = await readDocuments();
const counts = Object.fromEntries(["projects", "media", "experience", "engineering", "settings"].map((collection) => [collection, documents.filter((document) => document.collection === collection).length]));

if (!apply) {
  console.log(JSON.stringify({ status: "PASS", mode: "check", documents: documents.length, counts }, null, 2));
  process.exit(0);
}

const environment = process.env.CMS_ENVIRONMENT;
if (environment !== "preview" && environment !== "production") throw new Error("CMS_ENVIRONMENT must be preview or production");
if (process.env.CMS_DB_MIGRATION_CONFIRM !== environment) throw new Error(`Set CMS_DB_MIGRATION_CONFIRM=${environment} to confirm the target environment`);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const sql = neon(process.env.DATABASE_URL);
const migration = await fs.readFile(path.join(root, "migrations/001_cms_documents.sql"), "utf8");
for (const statement of migration.split(";").map((value) => value.trim()).filter(Boolean)) await sql.query(statement);

const existing = await sql.query("SELECT count(*)::int AS count FROM cms_documents WHERE environment = $1", [environment]);
if (Number(existing[0]?.count ?? 0) > 0 && !allowExisting) {
  throw new Error(`The ${environment} namespace is not empty. Re-run with --allow-existing only after reviewing the target.`);
}

await sql.transaction(documents.map(({ collection, id, item }) => {
  const slug = typeof item.slug === "string" && item.slug ? item.slug : null;
  const status = typeof item.status === "string" && item.status ? item.status : null;
  const order = typeof item.order === "number" && Number.isFinite(item.order) ? item.order : 0;
  return sql`
    INSERT INTO cms_documents (environment, collection, id, payload, slug, status, sort_order)
    VALUES (${environment}, ${collection}, ${id}, ${JSON.stringify(item)}::jsonb, ${slug}, ${status}, ${order})
    ON CONFLICT (environment, collection, id) DO UPDATE SET
      payload = EXCLUDED.payload,
      slug = EXCLUDED.slug,
      status = EXCLUDED.status,
      sort_order = EXCLUDED.sort_order,
      version = cms_documents.version + 1,
      updated_at = clock_timestamp()
    WHERE cms_documents.payload IS DISTINCT FROM EXCLUDED.payload
  `;
}));

const rows = await sql.query(
  "SELECT collection, id, payload FROM cms_documents WHERE environment = $1 ORDER BY collection, id",
  [environment],
);
const migrated = new Map(rows.map((row) => [`${row.collection}/${row.id}`, row.payload]));
const mismatches = documents.filter(({ collection, id, item }) => JSON.stringify(stable(migrated.get(`${collection}/${id}`))) !== JSON.stringify(stable(item))).map(({ collection, id }) => `${collection}/${id}`);
if (mismatches.length) throw new Error(`Migration verification failed: ${mismatches.join(", ")}`);

console.log(JSON.stringify({
  status: "PASS",
  mode: "apply-and-verify",
  environment,
  sourceDocuments: documents.length,
  verifiedDocuments: documents.length - mismatches.length,
  databaseDocuments: rows.length,
  counts,
}, null, 2));
