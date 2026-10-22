import fs from "node:fs/promises";
import path from "node:path";
import type { AdminSession } from "./session";
import { isLocalPreview } from "./session";
import {
  DocumentConflictError,
  DocumentNotFoundError,
  listDocuments,
  putDocument,
  removeDocument,
  type StoredDocument,
} from "./database";
import {
  collectionSchemas,
  type CollectionName,
  type EngineeringCase,
  type Experience,
  type MediaItem,
  type Project,
  type SiteSettings,
} from "./schema";

const contentRoot = path.join(process.cwd(), "content");

type CollectionRecordMap = {
  projects: Project;
  media: MediaItem;
  experience: Experience;
  engineering: EngineeringCase;
  settings: SiteSettings;
};

function usesLocalJsonFixtures() {
  return isLocalPreview() && process.env.CMS_CONTENT_ADAPTER === "json";
}

export class RepositoryError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

function collectionPath(collection: CollectionName, id: string) {
  const safe = id.replace(/[^a-zA-Z0-9-_]/g, "");
  if (!safe || safe !== id) throw new RepositoryError("Invalid content ID", 400);
  if (collection === "settings") return "content/settings/site.json";
  return `content/${collection}/${safe}.json`;
}

function validate(collection: CollectionName, value: unknown) {
  const parsed = collectionSchemas[collection].safeParse(value);
  if (!parsed.success) throw new RepositoryError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "), 422);
  return parsed.data;
}

async function listLocalDocuments(collection: CollectionName): Promise<Array<StoredDocument>> {
  if (collection === "settings") {
    const item = JSON.parse(await fs.readFile(path.join(contentRoot, "settings/site.json"), "utf8"));
    return [{ item, version: 1 }];
  }
  const dir = path.join(contentRoot, collection);
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  return Promise.all(names.filter((name) => name.endsWith(".json")).map(async (name) => ({
    item: JSON.parse(await fs.readFile(path.join(dir, name), "utf8")),
    version: 1,
  })));
}

export async function listCollectionDocuments<C extends CollectionName>(collection: C, session?: AdminSession): Promise<Array<StoredDocument<CollectionRecordMap[C]>>> {
  void session;
  return (usesLocalJsonFixtures() ? listLocalDocuments(collection) : listDocuments<CollectionRecordMap[C]>(collection)) as Promise<Array<StoredDocument<CollectionRecordMap[C]>>>;
}

export async function listCollection<C extends CollectionName>(collection: C, session?: AdminSession): Promise<Array<CollectionRecordMap[C]>> {
  return (await listCollectionDocuments(collection, session)).map((document) => document.item);
}

function collectMediaReferences(value: unknown, knownIds: Set<string>) {
  const missing = new Set<string>();
  const walk = (node: unknown, key = "") => {
    if (Array.isArray(node)) {
      if (key === "mediaIds") node.forEach((item) => { if (typeof item === "string" && item && !knownIds.has(item)) missing.add(item); });
      else node.forEach((item) => walk(item));
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [childKey, child] of Object.entries(node)) {
      if (["mediaId", "featuredMediaId", "beforeMediaId", "afterMediaId"].includes(childKey) && typeof child === "string" && child && !knownIds.has(child)) missing.add(child);
      else walk(child, childKey);
    }
  };
  walk(value);
  return [...missing];
}

async function validateRelations(collection: CollectionName, id: string, value: Record<string, unknown>, session: AdminSession) {
  if (collection === "projects" || collection === "engineering") {
    const peers = await listCollection(collection, session);
    const slug = String(value.slug ?? "");
    if (peers.some((item) => item.id !== id && item.slug === slug)) throw new RepositoryError(`Duplicate slug: ${slug}`, 409);
  }
  if (collection === "projects" || collection === "engineering") {
    const media = await listCollection("media", session);
    const missing = collectMediaReferences(value, new Set(media.map((item) => String(item.id))));
    if (missing.length) throw new RepositoryError(`Unknown media reference: ${missing.join(", ")}`, 422);
  }
  if (["projects", "engineering", "experience", "settings"].includes(collection)) {
    const projects = await listCollection("projects", session);
    const known = new Set(projects.map((item) => String(item.id)));
    if (collection === "projects") known.add(id);
    const relationKeys = ["projectIds", "relatedProjectIds", "featuredProjectIds"];
    const missing = relationKeys.flatMap((key) => Array.isArray(value[key]) ? (value[key] as string[]).filter((projectId) => projectId && !known.has(projectId)) : []);
    if (missing.length) throw new RepositoryError(`Unknown project reference: ${[...new Set(missing)].join(", ")}`, 422);
  }
  if (collection === "projects") {
    const cases = await listCollection("engineering", session);
    const known = new Set(cases.map((item) => String(item.id)));
    const missing = Array.isArray(value.engineeringCaseIds) ? (value.engineeringCaseIds as string[]).filter((caseId) => caseId && !known.has(caseId)) : [];
    if (missing.length) throw new RepositoryError(`Unknown engineering case reference: ${[...new Set(missing)].join(", ")}`, 422);
  }
}

export async function writeContent(
  collection: CollectionName,
  id: string,
  value: unknown,
  session: AdminSession,
  expectedVersion?: number,
) {
  const validated = validate(collection, value) as Record<string, unknown>;
  await validateRelations(collection, id, validated, session);
  if (usesLocalJsonFixtures()) {
    const relative = collectionPath(collection, id);
    const target = path.join(contentRoot, relative.replace(/^content\//, ""));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
    return { item: validated, version: 1 };
  }
  try {
    return await putDocument(collection, id, validated, expectedVersion);
  } catch (error) {
    if (error instanceof DocumentConflictError) throw new RepositoryError(error.message, 409);
    throw error;
  }
}

export async function deleteContent(
  collection: CollectionName,
  id: string,
  session: AdminSession,
  expectedVersion?: number,
) {
  if (collection === "settings") throw new RepositoryError("Site settings cannot be deleted", 400);
  if (collection === "media") await assertMediaUnused(id, session);
  if (collection === "projects") await assertProjectUnused(id, session);
  if (collection === "engineering") await assertEngineeringCaseUnused(id, session);
  if (usesLocalJsonFixtures()) {
    const relative = collectionPath(collection, id);
    await fs.unlink(path.join(contentRoot, relative.replace(/^content\//, ""))).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    return;
  }
  try {
    await removeDocument(collection, id, expectedVersion);
  } catch (error) {
    if (error instanceof DocumentConflictError) throw new RepositoryError(error.message, 409);
    if (error instanceof DocumentNotFoundError) throw new RepositoryError(error.message, 404);
    throw error;
  }
}

async function assertProjectUnused(projectId: string, session: AdminSession) {
  const [projects, engineering, experience, settings] = await Promise.all([
    listCollection("projects", session),
    listCollection("engineering", session),
    listCollection("experience", session),
    listCollection("settings", session),
  ]);
  const dependants = [...projects.filter((item) => item.id !== projectId), ...engineering, ...experience, ...settings];
  if (JSON.stringify(dependants).includes(`\"${projectId}\"`)) throw new RepositoryError("This project is still referenced by other content", 409);
}

async function assertEngineeringCaseUnused(caseId: string, session: AdminSession) {
  const projects = await listCollection("projects", session);
  if (projects.some((project) => Array.isArray(project.engineeringCaseIds) && project.engineeringCaseIds.includes(caseId))) throw new RepositoryError("This engineering case is still referenced by a project", 409);
}

async function assertMediaUnused(mediaId: string, session: AdminSession) {
  const [projects, engineering] = await Promise.all([listCollection("projects", session), listCollection("engineering", session)]);
  const serialized = JSON.stringify([...projects, ...engineering]);
  if (serialized.includes(`\"${mediaId}\"`)) throw new RepositoryError("This media is still referenced by a project or engineering case", 409);
}
