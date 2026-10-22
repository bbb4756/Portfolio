import fs from "node:fs/promises";

const base = process.argv[2] || "http://127.0.0.1:4182";
const output = process.argv[3] || "phase4-production-access-qa.json";
const sessionResponse = await fetch(`${base}/api/admin/session`);
const session = await sessionResponse.json();
const contentResponse = await fetch(`${base}/api/admin/content/projects`);
const uploadResponse = await fetch(`${base}/api/admin/media-direct/start`, { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ fileName: "unauthorized.mp4", contentType: "video/mp4", size: 24 * 1024 * 1024, title: "Unauthorized", alt: "Unauthorized" }) });
const adminResponse = await fetch(`${base}/admin`);
const admin = await adminResponse.text();
const draftResponse = await fetch(`${base}/engineering/next-react-upgrade`);
const checks = {
  localPreviewBypassDisabled: sessionResponse.status === 200 && session.authenticated === false && session.preview === false,
  contentApiUnauthorized: contentResponse.status === 401,
  directUploadUnauthorized: uploadResponse.status === 401,
  adminRequiresGitHubLogin: adminResponse.status === 200 && admin.includes("Continue with GitHub"),
  anonymousDraftHidden: draftResponse.status === 404,
};
const report = { generatedAt: new Date().toISOString(), base, verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL", checks, externalOAuth: "NOT_VERIFIED" };
await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.verdict !== "PASS") process.exitCode = 1;

