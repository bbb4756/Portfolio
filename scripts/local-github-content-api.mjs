import crypto from "node:crypto";
import http from "node:http";

const port = Number(process.env.PORT || 4184);
const files = new Map();
const commits = [];

function sha(content) {
  return crypto.createHash("sha1").update(content).digest("hex");
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  if (request.method === "GET" && url.pathname === "/__state") return json(response, 200, { files: [...files.entries()].map(([path, value]) => ({ path, sha: value.sha, content: value.content })), commits });

  const treeMatch = /^\/repos\/[^/]+\/[^/]+\/git\/trees\/([^/]+)$/.exec(url.pathname);
  if (request.method === "GET" && treeMatch) return json(response, 200, { sha: treeMatch[1], tree: [...files.keys()].map((path) => ({ path, type: "blob" })) });

  const contentMatch = /^\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/.exec(url.pathname);
  if (!contentMatch) return json(response, 404, { message: "Not Found" });
  const filePath = decodeURIComponent(contentMatch[1]);

  if (request.method === "GET") {
    const value = files.get(filePath);
    return value ? json(response, 200, { type: "file", path: filePath, sha: value.sha, content: value.content }) : json(response, 404, { message: "Not Found" });
  }

  if (request.method === "PUT") {
    const body = await readJson(request);
    const current = files.get(filePath);
    if (current && body.sha !== current.sha) return json(response, 409, { message: "SHA mismatch" });
    const value = { content: body.content, sha: sha(Buffer.from(body.content, "base64")) };
    files.set(filePath, value);
    commits.push({ method: "PUT", path: filePath, message: body.message, branch: body.branch, sha: value.sha });
    return json(response, 201, { content: { path: filePath, sha: value.sha }, commit: { sha: sha(`${value.sha}:${commits.length}`) } });
  }

  if (request.method === "DELETE") {
    const body = await readJson(request);
    const current = files.get(filePath);
    if (!current) return json(response, 404, { message: "Not Found" });
    if (body.sha !== current.sha) return json(response, 409, { message: "SHA mismatch" });
    files.delete(filePath);
    commits.push({ method: "DELETE", path: filePath, message: body.message, branch: body.branch });
    return json(response, 200, { commit: { sha: sha(`${filePath}:${commits.length}`) } });
  }

  return json(response, 405, { message: "Method Not Allowed" });
});

server.listen(port, "127.0.0.1", () => console.log(`Local GitHub Contents API ready at http://127.0.0.1:${port}`));

