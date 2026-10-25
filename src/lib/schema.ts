import { z } from "zod";

export const slugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only");

const webUrl = z.string().url().refine((value) => {
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
}, "Only HTTP(S) URLs are allowed");
const optionalUrl = z.union([z.literal(""), webUrl]).default("");

export const mediaKindSchema = z.enum(["image", "gif", "video"]);
const objectStorageSchema = z.object({
  provider: z.literal("object-storage"),
  key: z.string().min(1),
});
export const mediaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  alt: z.string().min(1, "Alt text is required"),
  kind: mediaKindSchema,
  file: z.string().min(1),
  poster: z.string().default(""),
  originalWidth: z.number().int().nonnegative().default(0),
  originalHeight: z.number().int().nonnegative().default(0),
  aspectRatio: z.string().default(""),
  fileSize: z.number().int().nonnegative().default(0),
  order: z.number().int().default(0),
  featured: z.boolean().default(false),
  autoplay: z.boolean().default(false),
  loop: z.boolean().default(true),
  muted: z.boolean().default(true),
  showOnMobile: z.boolean().default(true),
  showOnDesktop: z.boolean().default(true),
  history: z.array(z.string()).default([]),
  storage: objectStorageSchema.optional(),
  storageHistory: z.array(objectStorageSchema).default([]),
});

export const textBlockSchema = z.object({
  id: z.string(),
  type: z.literal("text"),
  preset: z.enum(["prose", "lead", "quote"]).default("prose"),
  title: z.string().default(""),
  body: z.string().default(""),
  emphasis: z.string().default(""),
});

export const imageBlockSchema = z.object({
  id: z.string(),
  type: z.literal("image"),
  preset: z.enum(["contained", "wide", "full-bleed"]).default("contained"),
  mediaId: z.string().min(1),
  caption: z.string().default(""),
});

export const videoBlockSchema = z.object({
  id: z.string(),
  type: z.literal("video"),
  preset: z.enum(["contained", "wide", "cinematic"]).default("contained"),
  mediaId: z.string().min(1),
  caption: z.string().default(""),
});

export const galleryBlockSchema = z.object({
  id: z.string(),
  type: z.literal("gallery"),
  preset: z.enum(["grid", "rail", "stack"]).default("grid"),
  mediaIds: z.array(z.string()).default([]),
});

export const deviceBlockSchema = z.object({
  id: z.string(),
  type: z.literal("device-showcase"),
  preset: z.enum(["single-phone", "multiple-phones", "browser", "editorial-split"]).default("single-phone"),
  mediaIds: z.array(z.string()).default([]),
  title: z.string().default(""),
  body: z.string().default(""),
});

export const problemSolutionBlockSchema = z.object({
  id: z.string(),
  type: z.literal("problem-solution"),
  preset: z.enum(["split", "sequence"]).default("split"),
  problem: z.string().default(""),
  solution: z.string().default(""),
});

export const decisionBlockSchema = z.object({
  id: z.string(),
  type: z.literal("technical-decision"),
  preset: z.enum(["decision-record", "comparison"]).default("decision-record"),
  title: z.string().default(""),
  context: z.string().default(""),
  options: z.array(z.string()).default([]),
  decision: z.string().default(""),
  rationale: z.string().default(""),
});

export const architectureBlockSchema = z.object({
  id: z.string(),
  type: z.literal("architecture"),
  preset: z.enum(["image", "mermaid"]).default("image"),
  mediaId: z.string().default(""),
  mermaid: z.string().default(""),
  caption: z.string().default(""),
});

export const codeBlockSchema = z.object({
  id: z.string(),
  type: z.literal("code"),
  preset: z.enum(["dark", "light"]).default("dark"),
  language: z.string().default("typescript"),
  code: z.string().default(""),
  caption: z.string().default(""),
});

export const metricsBlockSchema = z.object({
  id: z.string(),
  type: z.literal("metrics"),
  preset: z.enum(["grid", "inline"]).default("grid"),
  items: z.array(z.object({ label: z.string(), value: z.string(), evidence: z.string().default("") })).default([]),
});

export const timelineBlockSchema = z.object({
  id: z.string(),
  type: z.literal("timeline"),
  preset: z.enum(["vertical", "horizontal"]).default("vertical"),
  items: z.array(z.object({ period: z.string(), title: z.string(), body: z.string().default("") })).default([]),
});

export const beforeAfterBlockSchema = z.object({
  id: z.string(),
  type: z.literal("before-after"),
  preset: z.enum(["side-by-side", "stack"]).default("side-by-side"),
  beforeMediaId: z.string().default(""),
  afterMediaId: z.string().default(""),
  description: z.string().default(""),
});

export const calloutBlockSchema = z.object({
  id: z.string(),
  type: z.literal("callout"),
  preset: z.enum(["note", "result", "warning"]).default("note"),
  title: z.string().default(""),
  body: z.string().default(""),
});

export const relatedProjectsBlockSchema = z.object({
  id: z.string(),
  type: z.literal("related-projects"),
  preset: z.enum(["list", "media"]).default("list"),
  projectIds: z.array(z.string()).default([]),
});

export const caseStudyBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  imageBlockSchema,
  videoBlockSchema,
  galleryBlockSchema,
  deviceBlockSchema,
  problemSolutionBlockSchema,
  decisionBlockSchema,
  architectureBlockSchema,
  codeBlockSchema,
  metricsBlockSchema,
  timelineBlockSchema,
  beforeAfterBlockSchema,
  calloutBlockSchema,
  relatedProjectsBlockSchema,
]);

export const presentationSchema = z.object({
  platform: z.enum(["desktop-web", "mobile-web", "native-app", "hybrid-app"]),
  layout: z.enum(["single-phone", "multiple-phones", "browser-frame", "full-bleed", "editorial-split", "gallery"]),
  featuredMediaId: z.string().default(""),
  mediaIds: z.array(z.string()).default([]),
  frameStyle: z.enum(["graphite-titanium", "minimal-dark", "none"]).default("graphite-titanium"),
  deviceSize: z.enum(["compact", "regular", "large", "source-led"]).default("regular"),
  alignment: z.enum(["start", "center", "end", "asymmetric"]).default("center"),
  background: z.enum(["charcoal", "black", "ivory", "project-accent"]).default("charcoal"),
  imageFit: z.enum(["contain", "cover"]).default("contain"),
  desktopPreset: z.enum(["single", "staggered", "editorial", "wide"]).default("single"),
  mobilePreset: z.enum(["single", "two-up", "stack", "swipe"]).default("single"),
});

export const projectSchema = z.object({
  id: z.string().min(1),
  slug: slugSchema,
  name: z.string().min(1),
  subtitle: z.string().default(""),
  oneLiner: z.string().default(""),
  shortIntroduction: z.string().default(""),
  detailedIntroduction: z.string().default(""),
  projectType: z.enum(["company", "personal", "side-project"]),
  platform: z.enum(["web", "mobile-web", "native-app", "hybrid-app"]),
  period: z.string().default(""),
  organization: z.string().default(""),
  teamSize: z.string().default(""),
  role: z.string().default(""),
  contribution: z.string().default(""),
  techStack: z.array(z.string()).default([]),
  githubUrl: optionalUrl,
  serviceUrl: optionalUrl,
  externalLinks: z.array(z.object({ label: z.string(), url: webUrl })).default([]),
  status: z.enum(["draft", "published", "archived"]),
  featured: z.boolean().default(false),
  showOnHome: z.boolean().default(false),
  order: z.number().int().default(0),
  emphasis: z.enum(["standard", "large", "hero"]).default("standard"),
  listDescription: z.string().default(""),
  seoTitle: z.string().default(""),
  seoDescription: z.string().default(""),
  presentation: presentationSchema,
  blocks: z.array(caseStudyBlockSchema).default([]),
  engineeringCaseIds: z.array(z.string()).default([]),
  relatedProjectIds: z.array(z.string()).default([]),
  updatedAt: z.string(),
});

export const experienceSchema = z.object({
  id: z.string().min(1),
  company: z.string().min(1),
  period: z.string().default(""),
  role: z.string().default(""),
  services: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  projectIds: z.array(z.string()).default([]),
  order: z.number().int().default(0),
});

export const engineeringCaseSchema = z.object({
  id: z.string().min(1),
  slug: slugSchema,
  title: z.string().min(1),
  summary: z.string().default(""),
  technologies: z.array(z.string()).default([]),
  projectIds: z.array(z.string()).default([]),
  background: z.string().default(""),
  constraints: z.string().default(""),
  rootCause: z.string().default(""),
  alternatives: z.array(z.string()).default([]),
  solution: z.string().default(""),
  implementation: z.string().default(""),
  verification: z.string().default(""),
  result: z.string().default(""),
  learnings: z.string().default(""),
  mediaIds: z.array(z.string()).default([]),
  code: z.string().default(""),
  diagram: z.string().default(""),
  status: z.enum(["draft", "published", "archived"]),
  order: z.number().int().default(0),
});

export const siteSettingsSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  heroIntroduction: z.string().default(""),
  coreStack: z.array(z.string()).default([]),
  resumeUrl: optionalUrl,
  githubUrl: optionalUrl,
  email: z.union([z.literal(""), z.string().email()]).default(""),
  featuredProjectIds: z.array(z.string()).default([]),
  about: z.string().default(""),
  contact: z.string().default(""),
  seoTitle: z.string().default(""),
  seoDescription: z.string().default(""),
});

export const collectionSchemas = {
  projects: projectSchema,
  media: mediaSchema,
  experience: experienceSchema,
  engineering: engineeringCaseSchema,
  settings: siteSettingsSchema,
} as const;

export type MediaItem = z.infer<typeof mediaSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type EngineeringCase = z.infer<typeof engineeringCaseSchema>;
export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export type CaseStudyBlock = z.infer<typeof caseStudyBlockSchema>;
export type CollectionName = keyof typeof collectionSchemas;
