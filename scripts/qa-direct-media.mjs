import fs from "node:fs/promises";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4179";
const objectOrigin = process.argv[3] || "http://127.0.0.1:4181";
const videoPath = process.argv[4];
const reportPath = process.argv[5] || "phase4-direct-media-qa.json";
if (!videoPath) throw new Error("Usage: node scripts/qa-direct-media.mjs <app> <object-origin> <video-path> [report-path]");

const origin = new URL(base).origin;
const request = async (pathname, init = {}) => {
  const response = await fetch(`${base}${pathname}`, { ...init, headers: { Origin: origin, ...(init.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { response, body };
};

const steps = [];
const record = (name, pass, detail = {}) => { steps.push({ name, pass, detail }); if (!pass) throw new Error(`${name}: ${JSON.stringify(detail)}`); };
const file = await fs.readFile(videoPath);
const stat = await fs.stat(videoPath);
record("fixture exceeds 20 MB", stat.size > 20 * 1024 * 1024, { bytes: stat.size });

const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const admin = await context.newPage();
const browserErrors = [];
admin.on("pageerror", (error) => browserErrors.push(error.message));
admin.on("console", (message) => { if (message.type() === "error") browserErrors.push(`${message.text()} @ ${message.location().url}`); });
await admin.goto(`${base}/admin`, { waitUntil: "networkidle" });
await admin.getByRole("button", { name: "Media Library" }).click();
await admin.getByRole("heading", { name: "Media Library" }).waitFor();
const uploadForm = admin.locator(".upload-form");
await uploadForm.getByLabel("Title").fill("Direct upload QA video");
await uploadForm.getByLabel("File *").setInputFiles(videoPath);
await uploadForm.getByLabel("Alt text *").fill("Direct upload QA video frame");
await uploadForm.getByRole("button", { name: "Upload media" }).click();
const uploadMessage = admin.locator(".admin-message");
await uploadMessage.waitFor({ timeout: 120000 });
const uploadMessageText = (await uploadMessage.textContent())?.trim();
record("admin upload completion message", uploadMessageText === "Media uploaded and metadata committed.", { message: uploadMessageText });
const card = admin.locator(".media-library article", { hasText: "Direct upload QA video" });
await card.waitFor();
const cardVideoSource = await card.locator("video").getAttribute("src");
record("admin direct upload", Boolean(cardVideoSource?.startsWith(`${objectOrigin}/objects/media/`)), { source: cardVideoSource });

const listed = await request("/api/admin/content/media");
const media = listed.body.items.find((item) => item.title === "Direct upload QA video");
record("metadata committed", listed.response.ok && media?.storage?.provider === "object-storage" && media.fileSize === stat.size, { id: media?.id, bytes: media?.fileSize, storage: media?.storage });
await admin.close();

const projectId = "direct-video-qa";
const project = {
  id: projectId,
  slug: projectId,
  name: "Direct Video QA",
  subtitle: "Temporary local QA record",
  oneLiner: "20 MB 이상의 직접 업로드 재생 검증",
  shortIntroduction: "검증 후 삭제되는 임시 프로젝트입니다.",
  detailedIntroduction: "",
  projectType: "personal",
  platform: "hybrid-app",
  period: "",
  organization: "",
  teamSize: "",
  role: "",
  contribution: "",
  techStack: [],
  githubUrl: "",
  serviceUrl: "",
  externalLinks: [],
  status: "published",
  featured: false,
  showOnHome: false,
  order: 9999,
  emphasis: "standard",
  listDescription: "Temporary QA",
  seoTitle: "Direct Video QA",
  seoDescription: "Temporary QA",
  presentation: { platform: "hybrid-app", layout: "single-phone", featuredMediaId: media.id, mediaIds: [media.id], frameStyle: "graphite-titanium", deviceSize: "source-led", alignment: "center", background: "charcoal", imageFit: "contain", desktopPreset: "single", mobilePreset: "single" },
  blocks: [],
  engineeringCaseIds: [],
  relatedProjectIds: [],
  updatedAt: new Date().toISOString(),
};
const created = await request(`/api/admin/content/projects/${projectId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(project) });
record("temporary published project", created.response.ok, { status: created.response.status, error: created.body.error });

const detail = await context.newPage();
await detail.goto(`${base}/projects/${projectId}`, { waitUntil: "networkidle" });
await detail.getByRole("button", { name: "Play media" }).click();
const video = detail.locator(".detail-stage video");
await video.waitFor();
await video.evaluate((node) => new Promise((resolve, reject) => {
  const element = node;
  if (element.readyState >= 1) return resolve();
  element.addEventListener("loadedmetadata", () => resolve(), { once: true });
  element.addEventListener("error", () => reject(new Error("Video metadata failed to load")), { once: true });
}));
const playback = await video.evaluate((node) => ({ readyState: node.readyState, duration: node.duration, videoWidth: node.videoWidth, videoHeight: node.videoHeight, source: node.querySelector("source")?.src }));
record("public MP4 playback", playback.readyState >= 1 && playback.duration > 0 && playback.videoWidth > 0, playback);
await detail.close();

const removedProject = await request(`/api/admin/content/projects/${projectId}`, { method: "DELETE" });
record("temporary project deletion", removedProject.response.ok, { status: removedProject.response.status, error: removedProject.body.error });
const removedMedia = await request(`/api/admin/content/media/${media.id}`, { method: "DELETE" });
record("media metadata and object deletion", removedMedia.response.ok, { status: removedMedia.response.status, error: removedMedia.body.error });
const deletedObject = await fetch(media.file, { method: "HEAD" });
record("deleted object unavailable", deletedObject.status === 404, { status: deletedObject.status });

const failureStart = await request("/api/admin/media-direct/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: "cancelled.mp4", contentType: "video/mp4", size: file.length, title: "Cancelled", alt: "Cancelled upload", width: 1280, height: 720 }) });
record("failure-recovery ticket", failureStart.response.ok, { status: failureStart.response.status });
const partial = await fetch(failureStart.body.uploadUrl, { method: "PUT", headers: failureStart.body.headers, body: file.subarray(0, 1024) });
record("truncated upload rejected", partial.status === 422, { status: partial.status });
const cancelled = await request("/api/admin/media-direct/cancel", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadToken: failureStart.body.uploadToken }) });
record("failed upload cleanup", cancelled.response.ok, { status: cancelled.response.status });

await browser.close();
record("browser console", browserErrors.length === 0, { errors: browserErrors });
const report = { generatedAt: new Date().toISOString(), verdict: steps.every((step) => step.pass) ? "PASS" : "FAIL", fixture: { path: videoPath, bytes: stat.size }, steps };
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
