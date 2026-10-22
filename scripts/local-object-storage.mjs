import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const port = Number(process.env.PORT || 4181);
const root = path.resolve(process.env.LOCAL_MEDIA_ROOT || "/tmp/phase4-local-media");
const secret = process.env.CMS_SESSION_SECRET || "local-preview-secret-must-be-at-least-32-characters";
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://127.0.0.1:4179";

function digest(value) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeTarget(key, metadata = false) {
  const normalized = key.split("/").filter(Boolean);
  if (!normalized.length || normalized.some((part) => part === "." || part === "..")) throw new Error("Invalid object key");
  const base = metadata ? path.join(root, ".metadata") : root;
  const target = path.resolve(base, ...normalized) + (metadata ? ".json" : "");
  if (!target.startsWith(`${base}${path.sep}`)) throw new Error("Invalid object key");
  return target;
}

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Range");
  response.setHeader("Access-Control-Expose-Headers", "ETag,Content-Length,Content-Range");
}

function json(response, status, value) {
  cors(response);
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function removeObject(key) {
  await Promise.all([
    fsp.rm(safeTarget(key), { force: true }),
    fsp.rm(safeTarget(key, true), { force: true }),
  ]);
}

const server = http.createServer(async (request, response) => {
  try {
    cors(response);
    if (request.method === "OPTIONS") return response.writeHead(204).end();
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (request.method === "POST" && url.pathname === "/admin/finalize") {
      if (request.headers["x-local-media-secret"] !== secret) return json(response, 401, { error: "Unauthorized" });
      const { pendingKey, finalKey } = await readJson(request);
      const pending = safeTarget(String(pendingKey));
      const final = safeTarget(String(finalKey));
      const pendingMeta = safeTarget(String(pendingKey), true);
      const finalMeta = safeTarget(String(finalKey), true);
      await fsp.mkdir(path.dirname(final), { recursive: true });
      await fsp.mkdir(path.dirname(finalMeta), { recursive: true });
      await fsp.rename(pending, final);
      await fsp.rename(pendingMeta, finalMeta);
      return json(response, 200, { ok: true });
    }

    if (!url.pathname.startsWith("/objects/")) return json(response, 404, { error: "Not found" });
    const key = decodeURIComponent(url.pathname.slice("/objects/".length));
    const target = safeTarget(key);
    const metadataTarget = safeTarget(key, true);

    if (request.method === "PUT") {
      const expires = Number(url.searchParams.get("expires"));
      const type = url.searchParams.get("type") || "";
      const size = Number(url.searchParams.get("size"));
      const signature = url.searchParams.get("signature") || "";
      const expected = digest(`PUT\n${key}\n${expires}\n${type}\n${size}`);
      if (!expires || expires <= Date.now() || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return json(response, 401, { error: "Invalid or expired upload signature" });
      if (!Number.isSafeInteger(size) || size <= 0) return json(response, 400, { error: "Invalid expected size" });
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.mkdir(path.dirname(metadataTarget), { recursive: true });
      const temporary = `${target}.${crypto.randomUUID()}.part`;
      let received = 0;
      const limit = new Transform({
        transform(chunk, _encoding, callback) {
          received += chunk.length;
          callback(received > size ? new Error("Upload exceeds signed size") : null, chunk);
        },
      });
      try {
        await pipeline(request, limit, fs.createWriteStream(temporary, { flags: "wx" }));
        if (received !== size) throw new Error(`Expected ${size} bytes, received ${received}`);
        await fsp.rename(temporary, target);
        await fsp.writeFile(metadataTarget, JSON.stringify({ contentType: type, size }), "utf8");
      } catch (error) {
        await fsp.rm(temporary, { force: true });
        return json(response, 422, { error: error instanceof Error ? error.message : "Upload failed" });
      }
      response.writeHead(200, { ETag: `"${digest(`${key}:${size}`).slice(0, 32)}"` });
      return response.end();
    }

    if (request.method === "DELETE") {
      if (request.headers["x-local-media-secret"] !== secret) return json(response, 401, { error: "Unauthorized" });
      await removeObject(key);
      return json(response, 200, { ok: true });
    }

    if (request.method === "GET" || request.method === "HEAD") {
      const [stat, metadata] = await Promise.all([
        fsp.stat(target),
        fsp.readFile(metadataTarget, "utf8").then(JSON.parse),
      ]);
      const common = { "Accept-Ranges": "bytes", "Content-Type": metadata.contentType, "Cache-Control": key.startsWith("media/") ? "public, max-age=31536000, immutable" : "no-store" };
      if (request.method === "HEAD") {
        response.writeHead(200, { ...common, "Content-Length": stat.size });
        return response.end();
      }
      const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || "");
      if (match) {
        const start = Number(match[1]);
        const end = Math.min(match[2] ? Number(match[2]) : stat.size - 1, stat.size - 1);
        response.writeHead(206, { ...common, "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${stat.size}` });
        return fs.createReadStream(target, { start, end }).pipe(response);
      }
      response.writeHead(200, { ...common, "Content-Length": stat.size });
      return fs.createReadStream(target).pipe(response);
    }

    return json(response, 405, { error: "Method not allowed" });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    json(response, code === "ENOENT" ? 404 : 500, { error: error instanceof Error ? error.message : "Object storage error" });
  }
});

await fsp.mkdir(root, { recursive: true });
server.listen(port, "127.0.0.1", () => console.log(`Local object storage ready at http://127.0.0.1:${port}`));

