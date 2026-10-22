import crypto from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { RepositoryError } from "./repository";
import { isLocalPreview } from "./session";

export const allowedMediaTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm"]);
export const directUploadThreshold = 4 * 1024 * 1024;
const defaultMaxBytes = 250 * 1024 * 1024;
const uploadLifetimeMs = 10 * 60 * 1000;

export type UploadTicket = {
  id: string;
  pendingKey: string;
  finalKey: string;
  fileName: string;
  contentType: string;
  size: number;
  title: string;
  alt: string;
  width: number;
  height: number;
  replaceId?: string;
  expectedVersion?: number;
  expiresAt: number;
};

type StoredMedia = {
  storage?: { provider?: string; key?: string };
  storageHistory?: Array<{ provider?: string; key?: string }>;
};

function secret() {
  const value = process.env.CMS_SESSION_SECRET;
  if (!value || value.length < 32) throw new RepositoryError("CMS_SESSION_SECRET must contain at least 32 characters", 503);
  return value;
}

function digest(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export function mediaMaxBytes() {
  const configured = Number(process.env.CMS_MEDIA_MAX_BYTES ?? defaultMaxBytes);
  return Number.isSafeInteger(configured) && configured >= 20 * 1024 * 1024 ? configured : defaultMaxBytes;
}

export function mediaObjectKey(kind: "pending" | "media", leaf: string) {
  const environment = process.env.CMS_ENVIRONMENT;
  if (environment !== "preview" && environment !== "production") {
    if (process.env.NODE_ENV === "production") throw new RepositoryError("CMS_ENVIRONMENT must be preview or production", 503);
    return `preview/${kind}/${leaf}`;
  }
  return `${environment}/${kind}/${leaf}`;
}

export function createUploadTicket(value: Omit<UploadTicket, "expiresAt">) {
  const payload = Buffer.from(JSON.stringify({ ...value, expiresAt: Date.now() + uploadLifetimeMs })).toString("base64url");
  return `${payload}.${digest(payload)}`;
}

export function readUploadTicket(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new RepositoryError("Invalid upload token", 401);
  const expected = digest(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new RepositoryError("Invalid upload token", 401);
  let ticket: UploadTicket;
  try { ticket = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as UploadTicket; }
  catch { throw new RepositoryError("Invalid upload token", 401); }
  if (!ticket.expiresAt || ticket.expiresAt <= Date.now()) throw new RepositoryError("Upload token expired", 401);
  return ticket;
}

function storageMode() {
  const mode = process.env.CMS_MEDIA_STORAGE;
  if (mode === "local-direct" && isLocalPreview()) return mode;
  if (mode === "r2") return mode;
  throw new RepositoryError("Direct media storage is not configured. Set CMS_MEDIA_STORAGE and its server-side credentials.", 503);
}

function requireValue(name: string) {
  const value = process.env[name];
  if (!value) throw new RepositoryError(`${name} is required for direct media storage`, 503);
  return value;
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function publicUrl(key: string) {
  return `${requireValue("CMS_MEDIA_PUBLIC_BASE_URL").replace(/\/$/, "")}/${encodeKey(key)}`;
}

function r2Config() {
  return {
    accountId: requireValue("R2_ACCOUNT_ID"),
    accessKeyId: requireValue("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireValue("R2_SECRET_ACCESS_KEY"),
    bucket: requireValue("R2_BUCKET_NAME"),
  };
}

function r2Client() {
  const config = r2Config();
  return {
    bucket: config.bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    }),
  };
}

function localAdminHeaders() {
  return { "x-local-media-secret": secret() };
}

function localObjectUrl(key: string) {
  return `${requireValue("CMS_LOCAL_MEDIA_ORIGIN").replace(/\/$/, "")}/objects/${encodeKey(key)}`;
}

export async function createDirectUpload(ticket: UploadTicket) {
  const mode = storageMode();
  if (mode === "local-direct") {
    const expires = ticket.expiresAt;
    const signature = digest(`PUT\n${ticket.pendingKey}\n${expires}\n${ticket.contentType}\n${ticket.size}`);
    const uploadUrl = new URL(localObjectUrl(ticket.pendingKey));
    uploadUrl.searchParams.set("expires", String(expires));
    uploadUrl.searchParams.set("type", ticket.contentType);
    uploadUrl.searchParams.set("size", String(ticket.size));
    uploadUrl.searchParams.set("signature", signature);
    return { uploadUrl: uploadUrl.toString(), headers: { "Content-Type": ticket.contentType } };
  }
  const { client, bucket } = r2Client();
  const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: ticket.pendingKey, ContentType: ticket.contentType }), { expiresIn: 600 });
  return { uploadUrl, headers: { "Content-Type": ticket.contentType } };
}

async function objectInfo(key: string) {
  if (storageMode() === "local-direct") {
    const head = await fetch(localObjectUrl(key), { method: "HEAD", headers: localAdminHeaders(), cache: "no-store" });
    if (!head.ok) throw new RepositoryError(`Object storage HEAD failed: ${head.status}`, 502);
    const prefixResponse = await fetch(localObjectUrl(key), { headers: { ...localAdminHeaders(), Range: "bytes=0-31" }, cache: "no-store" });
    if (!prefixResponse.ok) throw new RepositoryError(`Object storage validation read failed: ${prefixResponse.status}`, 502);
    return { size: Number(head.headers.get("content-length") ?? 0), contentType: head.headers.get("content-type") ?? "", prefix: Buffer.from(await prefixResponse.arrayBuffer()) };
  }
  const { client, bucket } = r2Client();
  const [head, prefix] = await Promise.all([
    client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })),
    client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-31" })),
  ]);
  return { size: Number(head.ContentLength ?? 0), contentType: head.ContentType ?? "", prefix: Buffer.from(await prefix.Body!.transformToByteArray()) };
}

function validateSignature(bytes: Buffer, mime: string) {
  const ascii = (start: number, end: number) => bytes.subarray(start, end).toString("ascii");
  const hex = bytes.subarray(0, 12).toString("hex");
  const valid =
    (mime === "image/png" && hex.startsWith("89504e470d0a1a0a")) ||
    (mime === "image/jpeg" && hex.startsWith("ffd8ff")) ||
    (mime === "image/gif" && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) ||
    (mime === "image/webp" && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") ||
    (mime === "video/mp4" && ascii(4, 8) === "ftyp") ||
    (mime === "video/webm" && hex.startsWith("1a45dfa3"));
  if (!valid) throw new RepositoryError("File signature does not match the declared media type", 415);
}

export async function validateUploadedObject(ticket: UploadTicket) {
  const info = await objectInfo(ticket.pendingKey);
  if (info.size !== ticket.size) throw new RepositoryError(`Uploaded size mismatch: expected ${ticket.size}, received ${info.size}`, 422);
  if (info.contentType.split(";")[0] !== ticket.contentType) throw new RepositoryError(`Uploaded content type mismatch: expected ${ticket.contentType}`, 422);
  validateSignature(info.prefix, ticket.contentType);
}

export async function finalizeUploadedObject(ticket: UploadTicket) {
  if (storageMode() === "local-direct") {
    const response = await fetch(`${requireValue("CMS_LOCAL_MEDIA_ORIGIN").replace(/\/$/, "")}/admin/finalize`, {
      method: "POST",
      headers: { ...localAdminHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ pendingKey: ticket.pendingKey, finalKey: ticket.finalKey }),
    });
    if (!response.ok) throw new RepositoryError(`Object storage finalize failed: ${response.status}`, 502);
    return { file: publicUrl(ticket.finalKey), storage: { provider: "object-storage" as const, key: ticket.finalKey } };
  }
  const { client, bucket } = r2Client();
  await client.send(new CopyObjectCommand({ Bucket: bucket, Key: ticket.finalKey, CopySource: `${bucket}/${encodeKey(ticket.pendingKey)}`, ContentType: ticket.contentType, MetadataDirective: "REPLACE" }));
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: ticket.pendingKey }));
  return { file: publicUrl(ticket.finalKey), storage: { provider: "object-storage" as const, key: ticket.finalKey } };
}

export async function deleteObject(key: string) {
  if (storageMode() === "local-direct") {
    const response = await fetch(localObjectUrl(key), { method: "DELETE", headers: localAdminHeaders() });
    if (!response.ok && response.status !== 404) throw new RepositoryError(`Object storage delete failed: ${response.status}`, 502);
    return;
  }
  const { client, bucket } = r2Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function deleteManagedMediaObjects(item: StoredMedia) {
  const keys = [item.storage, ...(item.storageHistory ?? [])]
    .filter((entry) => entry?.provider === "object-storage" && entry.key)
    .map((entry) => entry!.key!);
  for (const key of [...new Set(keys)]) await deleteObject(key);
}

export function mediaObjectUrl(key: string) {
  return publicUrl(key);
}
