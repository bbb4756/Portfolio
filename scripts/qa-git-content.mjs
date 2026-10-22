const base = process.argv[2] || "http://127.0.0.1:4183";
const github = process.argv[3] || "http://127.0.0.1:4184";
const origin = new URL(base).origin;
const id = "git-adapter-qa";
const project = {
  id,
  slug: id,
  name: "Git adapter QA",
  subtitle: "Temporary record",
  oneLiner: "GitHub Contents API adapter verification",
  shortIntroduction: "",
  detailedIntroduction: "",
  projectType: "personal",
  platform: "web",
  period: "",
  organization: "",
  teamSize: "",
  role: "",
  contribution: "",
  techStack: [],
  githubUrl: "",
  serviceUrl: "",
  externalLinks: [],
  status: "draft",
  featured: false,
  showOnHome: false,
  order: 9999,
  emphasis: "standard",
  listDescription: "",
  seoTitle: "",
  seoDescription: "",
  presentation: { platform: "desktop-web", layout: "browser-frame", featuredMediaId: "", mediaIds: [], frameStyle: "minimal-dark", deviceSize: "regular", alignment: "center", background: "charcoal", imageFit: "contain", desktopPreset: "wide", mobilePreset: "single" },
  blocks: [],
  engineeringCaseIds: [],
  relatedProjectIds: [],
  updatedAt: new Date().toISOString(),
};

const call = async (method, value) => {
  const response = await fetch(`${base}/api/admin/content/projects/${id}`, { method, headers: { Origin: origin, "Content-Type": "application/json" }, ...(value ? { body: JSON.stringify(value) } : {}) });
  return { status: response.status, body: await response.json() };
};

const create = await call("PUT", project);
const update = await call("PUT", { ...project, name: "Git adapter QA updated", updatedAt: new Date().toISOString() });
const remove = await call("DELETE");
const state = await fetch(`${github}/__state`).then((response) => response.json());
const results = [
  { name: "Git create commit", pass: create.status === 200 && state.commits[0]?.method === "PUT" && state.commits[0]?.message === `content(projects): create ${id}`, detail: { response: create.status, commit: state.commits[0] } },
  { name: "Git update commit", pass: update.status === 200 && state.commits[1]?.method === "PUT" && state.commits[1]?.message === `content(projects): update ${id}`, detail: { response: update.status, commit: state.commits[1] } },
  { name: "Git delete commit", pass: remove.status === 200 && state.commits[2]?.method === "DELETE" && state.commits[2]?.message === `content(projects): delete ${id}`, detail: { response: remove.status, commit: state.commits[2] } },
  { name: "Content branch isolation", pass: state.commits.every((commit) => commit.branch === "portfolio-content"), detail: { branches: state.commits.map((commit) => commit.branch) } },
  { name: "No residual record", pass: state.files.every((file) => file.path !== `content/projects/${id}.json`), detail: { paths: state.files.map((file) => file.path) } },
];
const report = { generatedAt: new Date().toISOString(), verdict: results.every((result) => result.pass) ? "PASS" : "FAIL", scope: "Local mock of GitHub Contents API; real GitHub OAuth and GitHub infrastructure are NOT VERIFIED", results };
console.log(JSON.stringify(report, null, 2));
if (report.verdict !== "PASS") process.exitCode = 1;

