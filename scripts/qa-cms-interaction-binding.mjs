import fs from "node:fs/promises";
import { chromium } from "playwright-core";

const base = process.env.CMS_PREVIEW_BASE || "http://127.0.0.1:4183";
const output = process.env.QA_OUTPUT_FILE;
if (!output) throw new Error("QA_OUTPUT_FILE is required");

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(base, { waitUntil: "networkidle" });
const originals = await page.evaluate(async () => {
  const [settingsResponse, projectsResponse] = await Promise.all([
    fetch("/api/admin/content/settings"),
    fetch("/api/admin/content/projects"),
  ]);
  if (!settingsResponse.ok || !projectsResponse.ok) throw new Error("Preview CMS read failed");
  const settingsBody = await settingsResponse.json();
  const projectsBody = await projectsResponse.json();
  const settings = settingsBody.items[0];
  const projects = projectsBody.items;
  return { settings, settingsVersion: settingsBody.versions.site, project: projects.find((item) => item.id === "dbs"), projectVersion: projectsBody.versions.dbs };
});

const temporary = {
  settings: {
    ...originals.settings,
    name: "CMS Preview Name",
    role: "CMS Preview Role",
    heroIntroduction: "CMS preview introduction binding check.",
    coreStack: ["CMS", "H2", "W1"],
  },
  project: { ...originals.project, name: "CMS Preview Project" },
};

async function write(collection, id, value, version) {
  return page.evaluate(async ({ collection, id, value, version }) => {
    const response = await fetch(`/api/admin/content/${collection}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(version ? { "If-Match": String(version) } : {}) },
      body: JSON.stringify(value),
    });
    return { status: response.status, body: await response.json() };
  }, { collection, id, value, version });
}

let result;
let restoreVersions = { settings: originals.settingsVersion, project: originals.projectVersion };
try {
  const settingsWrite = await write("settings", "site", temporary.settings, originals.settingsVersion);
  const projectWrite = await write("projects", "dbs", temporary.project, originals.projectVersion);
  restoreVersions = { settings: settingsWrite.body.version, project: projectWrite.body.version };
  await page.goto(base, { waitUntil: "networkidle" });
  const renderedTemporary = await page.evaluate(() => ({
    name: document.querySelector("#hero-title")?.getAttribute("aria-label"),
    role: document.querySelector(".magnetic-role")?.textContent?.trim(),
    introduction: document.querySelector(".magnetic-hero-footer > p:nth-child(2)")?.textContent?.trim(),
    stack: document.querySelector(".magnetic-stack")?.textContent?.trim(),
    firstProject: document.querySelector(".editorial-project-copy h3")?.textContent?.trim(),
    glyphCount: document.querySelectorAll(".magnetic-glyph").length,
  }));
  result = {
    generatedAt: new Date().toISOString(),
    scope: "Isolated local Preview adapter; canonical content is not modified",
    writes: { settings: settingsWrite.status, project: projectWrite.status },
    renderedTemporary,
    errors,
    status: settingsWrite.status === 200
      && projectWrite.status === 200
      && renderedTemporary.name === temporary.settings.name
      && renderedTemporary.role === temporary.settings.role
      && renderedTemporary.introduction === temporary.settings.heroIntroduction
      && renderedTemporary.stack === temporary.settings.coreStack.join(" / ")
      && renderedTemporary.firstProject === temporary.project.name
      && renderedTemporary.glyphCount === temporary.settings.name.length - 1
      && errors.length === 0 ? "PASS" : "FAIL",
  };
} finally {
  await write("settings", "site", originals.settings, restoreVersions.settings);
  await write("projects", "dbs", originals.project, restoreVersions.project);
  await page.goto(base, { waitUntil: "networkidle" });
  const restored = await page.evaluate(() => ({
    name: document.querySelector("#hero-title")?.getAttribute("aria-label"),
    firstProject: document.querySelector(".editorial-project-copy h3")?.textContent?.trim(),
  }));
  result = {
    ...result,
    restored,
    restoreStatus: restored.name === originals.settings.name && restored.firstProject === originals.project.name ? "PASS" : "FAIL",
  };
  await fs.writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
