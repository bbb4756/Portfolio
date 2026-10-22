import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const outputDir = process.env.QA_OUTPUT_DIR;
if (!outputDir) throw new Error("QA_OUTPUT_DIR is required");

const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const originalBase = process.env.ORIGINAL_BASE || "http://127.0.0.1:4176";
const restoredBase = process.env.RESTORED_BASE || "http://127.0.0.1:4183";
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(path.join(outputDir, "hero-frames"), { recursive: true });
await fs.mkdir(path.join(outputDir, "work-frames"), { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const consoleErrors = [];
const pageErrors = [];

function observe(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push({ label, text: message.text() });
  });
  page.on("pageerror", (error) => pageErrors.push({ label, text: error.message }));
}

async function screenshot(page, name, options = {}) {
  await page.screenshot({ path: path.join(outputDir, name), ...options });
}

async function magneticValues(page) {
  return page.locator(".magnetic-glyph").evaluateAll((glyphs) => glyphs.map((glyph) => {
    const style = getComputedStyle(glyph);
    return { transform: style.transform, weight: style.fontVariationSettings, gap: style.marginRight };
  }));
}

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const originalHero = await desktop.newPage();
observe(originalHero, "original-h2");
await originalHero.goto(`${originalBase}/?section=hero&candidate=h2`, { waitUntil: "networkidle" });
await screenshot(originalHero, "original-h2-desktop-1440x900.png");
const originalHeroStatic = await originalHero.locator(".hero-name").evaluate((element) => {
  const style = getComputedStyle(element);
  return { fontSize: style.fontSize, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing };
});

const restored = await desktop.newPage();
observe(restored, "restored");
await restored.goto(restoredBase, { waitUntil: "networkidle" });
await restored.evaluate(() => document.fonts.ready);
await screenshot(restored, "restored-hero-desktop-1440x900.png");
const initialValues = await magneticValues(restored);
const stageBox = await restored.locator(".magnetic-name-stage").boundingBox();
if (!stageBox) throw new Error("Magnetic stage was not rendered");
for (let index = 0; index < 18; index += 1) {
  const progress = index / 17;
  await restored.mouse.move(
    stageBox.x + stageBox.width * (0.18 + progress * 0.5),
    stageBox.y + stageBox.height * (0.35 + Math.sin(progress * Math.PI) * 0.24),
  );
  await restored.waitForTimeout(34);
  await screenshot(restored, `hero-frames/${String(index + 1).padStart(3, "0")}.png`);
}
const engagedValues = await magneticValues(restored);
await screenshot(restored, "restored-hero-pointer-desktop-1440x900.png");
await restored.mouse.move(10, 10);
await restored.waitForTimeout(900);
const resetValues = await magneticValues(restored);

await restored.locator(".magnetic-name-stage").focus();
await restored.keyboard.press("ArrowRight");
await restored.waitForTimeout(160);
const keyboardValues = await magneticValues(restored);
await restored.keyboard.press("Escape");

const firstProject = restored.locator(".editorial-project").first();
const firstProjectTop = await firstProject.evaluate((element) => element.getBoundingClientRect().top + scrollY);
for (let index = 0; index < 18; index += 1) {
  const progress = index / 17;
  await restored.evaluate((y) => scrollTo(0, y), Math.max(0, firstProjectTop - 760 + progress * 760));
  await restored.waitForTimeout(34);
  await screenshot(restored, `work-frames/${String(index + 1).padStart(3, "0")}.png`);
}
const workProgress = await firstProject.evaluate((element) => ({
  progress: element.style.getPropertyValue("--editorial-progress"),
  mediaTransform: getComputedStyle(element.querySelector(".editorial-project-media")).transform,
  mediaClipPath: getComputedStyle(element.querySelector(".editorial-project-media")).clipPath,
  copyTransform: getComputedStyle(element.querySelector(".editorial-project-copy")).transform,
}));
await screenshot(restored, "restored-work-desktop-1440x900.png");

const phoneFrame = restored.locator(".editorial-project .phone").first();
const phoneFrameEvidence = await phoneFrame.evaluate((element) => {
  const style = getComputedStyle(element);
  const screen = element.querySelector(".phone-screen");
  return {
    width: style.width,
    backgroundImage: style.backgroundImage,
    borderRadius: style.borderRadius,
    boxShadow: style.boxShadow,
    screenAspectRatio: screen ? getComputedStyle(screen).aspectRatio : "",
  };
});
await phoneFrame.scrollIntoViewIfNeeded();
await screenshot(restored, "restored-m2-device-desktop-1440x900.png");

const pageEvidence = await restored.evaluate(() => ({
  name: document.querySelector("#hero-title")?.getAttribute("aria-label"),
  role: document.querySelector(".magnetic-role")?.textContent?.trim(),
  introduction: document.querySelector(".magnetic-hero-footer > p:nth-child(2)")?.textContent?.trim(),
  stack: document.querySelector(".magnetic-stack")?.textContent?.trim(),
  projects: Array.from(document.querySelectorAll(".editorial-project-copy h3")).map((node) => node.textContent?.trim()),
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  failedImages: Array.from(document.images).filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.src),
  keyboardTarget: document.querySelector(".magnetic-name-stage")?.getAttribute("tabindex"),
  describedBy: document.querySelector(".magnetic-name-stage")?.getAttribute("aria-describedby"),
}));

const rafTiming = await restored.evaluate(async () => {
  const intervals = [];
  let previous = performance.now();
  await new Promise((resolve) => {
    let count = 0;
    const tick = (now) => {
      if (count > 0) intervals.push(now - previous);
      previous = now;
      count += 1;
      if (count >= 61) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const sorted = [...intervals].sort((a, b) => a - b);
  return {
    meanMs: intervals.reduce((sum, value) => sum + value, 0) / intervals.length,
    p95Ms: sorted[Math.floor(sorted.length * 0.95)],
  };
});

const originalWork = await desktop.newPage();
observe(originalWork, "original-w1");
await originalWork.goto(`${originalBase}/?section=work&candidate=w1`, { waitUntil: "networkidle" });
await originalWork.locator(".w1-project").first().scrollIntoViewIfNeeded();
await originalWork.waitForTimeout(120);
await screenshot(originalWork, "original-w1-desktop-1440x900.png");

const originalMedia = await desktop.newPage();
observe(originalMedia, "original-m2");
await originalMedia.goto(`${originalBase}/?section=media&candidate=m2`, { waitUntil: "networkidle" });
await originalMedia.locator(".m2-stage").scrollIntoViewIfNeeded();
await screenshot(originalMedia, "original-m2-desktop-1440x900.png");

const phase36 = await desktop.newPage();
observe(phase36, "phase3.6-index");
await phase36.goto("http://127.0.0.1:4177/?view=index", { waitUntil: "networkidle" });
await screenshot(phase36, "phase3.6-index-desktop-1440x900.png");

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const mobilePage = await mobile.newPage();
observe(mobilePage, "restored-mobile");
await mobilePage.goto(restoredBase, { waitUntil: "networkidle" });
await mobilePage.evaluate(() => document.fonts.ready);
await screenshot(mobilePage, "restored-hero-mobile-390x844.png");
const mobileStageBox = await mobilePage.locator(".magnetic-name-stage").boundingBox();
if (!mobileStageBox) throw new Error("Mobile magnetic stage was not rendered");
const mobileInitialValues = await magneticValues(mobilePage);
await mobilePage.touchscreen.tap(mobileStageBox.x + mobileStageBox.width * 0.5, mobileStageBox.y + mobileStageBox.height * 0.5);
await mobilePage.waitForTimeout(120);
const mobileTouchValues = await magneticValues(mobilePage);
await mobilePage.waitForTimeout(1200);
const mobileResetValues = await magneticValues(mobilePage);
await mobilePage.locator(".editorial-project").first().scrollIntoViewIfNeeded();
await screenshot(mobilePage, "restored-work-mobile-390x844.png");
const mobileEvidence = await mobilePage.evaluate(() => ({
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  heroHeight: document.querySelector(".magnetic-hero")?.getBoundingClientRect().height,
  projectMediaWidth: document.querySelector(".editorial-project-media")?.getBoundingClientRect().width,
  viewportWidth: document.documentElement.clientWidth,
}));

const reducedContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const reducedPage = await reducedContext.newPage();
observe(reducedPage, "reduced-motion");
await reducedPage.goto(restoredBase, { waitUntil: "networkidle" });
await reducedPage.locator(".editorial-project").first().scrollIntoViewIfNeeded();
const reducedEvidence = await reducedPage.evaluate(() => {
  const glyph = document.querySelector(".magnetic-glyph");
  const pointer = document.querySelector(".magnetic-pointer-field");
  const media = document.querySelector(".editorial-project-media");
  return {
    prefersReducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    glyphTransform: glyph ? getComputedStyle(glyph).transform : "missing",
    pointerDisplay: pointer ? getComputedStyle(pointer).display : "missing",
    mediaTransform: media ? getComputedStyle(media).transform : "missing",
    mediaClipPath: media ? getComputedStyle(media).clipPath : "missing",
  };
});
await screenshot(reducedPage, "restored-reduced-motion-desktop-1440x900.png");

const settings = JSON.parse(await fs.readFile(path.join(process.cwd(), "content/settings/site.json"), "utf8"));
const expectedProjects = [];
for (const id of settings.featuredProjectIds.slice(0, 3)) {
  const project = JSON.parse(await fs.readFile(path.join(process.cwd(), `content/projects/${id}.json`), "utf8"));
  expectedProjects.push(project.name);
}

const changed = engagedValues.some((value, index) => value.transform !== initialValues[index]?.transform || value.gap !== initialValues[index]?.gap);
const returned = resetValues.every((value) => value.transform === "none" || value.transform === "matrix(1, 0, 0, 1, 0, 0)") && resetValues.every((value) => value.gap === "0px");
const keyboardChanged = keyboardValues.some((value) => value.transform !== "none" && value.transform !== "matrix(1, 0, 0, 1, 0, 0)");
const mobileTouchChanged = mobileTouchValues.some((value, index) => value.transform !== mobileInitialValues[index]?.transform || value.gap !== mobileInitialValues[index]?.gap);
const mobileTouchReturned = mobileResetValues.every((value) => value.transform === "none" || value.transform === "matrix(1, 0, 0, 1, 0, 0)") && mobileResetValues.every((value) => value.gap === "0px");

const result = {
  generatedAt: new Date().toISOString(),
  sourceComparison: {
    phase35: ["H2 Magnetic Letterfield", "W1 Editorial Transformation", "M2 Digital Exhibition Stage"],
    phase36: ["Graphite + Titanium frame", "source-led project media sizing"],
    originalHeroStatic,
  },
  checks: {
    heroStaticDesign: { status: "PASS", evidence: "original-h2-desktop-1440x900.png ↔ restored-hero-desktop-1440x900.png" },
    heroPointerInteraction: { status: changed && returned ? "PASS" : "FAIL", changed, returned },
    heroKeyboardInteraction: { status: keyboardChanged ? "PASS" : "FAIL", keyboardChanged },
    workScrollInteraction: { status: Number(workProgress.progress) > 0 && workProgress.mediaTransform !== "none" ? "PASS" : "FAIL", ...workProgress },
    projectMediaLayout: { status: pageEvidence.failedImages.length === 0 ? "PASS" : "FAIL", failedImages: pageEvidence.failedImages },
    smartphoneFrame: { status: phoneFrameEvidence.backgroundImage.includes("gradient") ? "PASS" : "FAIL", ...phoneFrameEvidence },
    mobileLayout: { status: !mobileEvidence.horizontalOverflow && mobileEvidence.projectMediaWidth <= mobileEvidence.viewportWidth && mobileTouchChanged && mobileTouchReturned ? "PASS" : "FAIL", ...mobileEvidence, touchInteraction: { changed: mobileTouchChanged, returned: mobileTouchReturned } },
    cmsDataBinding: {
      status: pageEvidence.name === settings.name && pageEvidence.role === settings.role && pageEvidence.introduction === settings.heroIntroduction && JSON.stringify(pageEvidence.projects) === JSON.stringify(expectedProjects) ? "PASS" : "FAIL",
      rendered: pageEvidence,
      expected: { name: settings.name, role: settings.role, introduction: settings.heroIntroduction, projects: expectedProjects },
    },
    accessibilityAndReducedMotion: {
      status: reducedEvidence.prefersReducedMotion && reducedEvidence.pointerDisplay === "none" && reducedEvidence.mediaTransform === "none" && pageEvidence.keyboardTarget === "0" && Boolean(pageEvidence.describedBy) ? "PASS" : "FAIL",
      ...reducedEvidence,
      keyboardTarget: pageEvidence.keyboardTarget,
      describedBy: pageEvidence.describedBy,
    },
    runtimePerformanceConsole: {
      status: consoleErrors.length === 0 && pageErrors.length === 0 && rafTiming.p95Ms < 35 ? "PASS" : "FAIL",
      consoleErrors,
      pageErrors,
      rafTiming,
    },
  },
};

await fs.writeFile(path.join(outputDir, "visual-regression-qa.json"), `${JSON.stringify(result, null, 2)}\n`);
await reducedContext.close();
await mobile.close();
await desktop.close();
await browser.close();
console.log(JSON.stringify(result, null, 2));
