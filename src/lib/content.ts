import { unstable_noStore as noStore } from "next/cache";
import { listCollection } from "./repository";
import {
  engineeringCaseSchema,
  experienceSchema,
  mediaSchema,
  projectSchema,
  siteSettingsSchema,
  type EngineeringCase,
  type Experience,
  type MediaItem,
  type Project,
  type SiteSettings,
} from "./schema";
import { getAdminSession } from "./session";

type Parser<T> = { safeParse: (value: unknown) => { success: boolean; data?: T; error?: unknown } };

async function readCollection<T>(collection: "projects" | "media" | "experience" | "engineering", parser: Parser<T>) {
  const records = await listCollection(collection);
  const values: T[] = [];
  for (const record of records) {
    const parsed = parser.safeParse(record);
    if (parsed.success && parsed.data) values.push(parsed.data);
    else console.error(`[content] Invalid ${collection}/${String(record.id ?? "unknown")}`, parsed.error);
  }
  return values;
}

export async function getAllProjects(): Promise<Project[]> {
  noStore();
  const projects = await readCollection<Project>("projects", projectSchema);
  const seen = new Set<string>();
  return projects
    .filter((project) => {
      if (seen.has(project.slug)) {
        console.error(`[content] Duplicate project slug ignored: ${project.slug}`);
        return false;
      }
      seen.add(project.slug);
      return true;
    })
    .sort((a, b) => a.order - b.order);
}

export async function getPublishedProjects() {
  return (await getAllProjects()).filter((project) => project.status === "published");
}

export async function getProjectBySlug(slug: string) {
  const projects = await getAllProjects();
  const project = projects.find((item) => item.slug === slug) ?? null;
  if (!project || project.status === "published") return project;
  return (await getAdminSession()) ? project : null;
}

export async function getMedia(): Promise<MediaItem[]> {
  noStore();
  return (await readCollection<MediaItem>("media", mediaSchema)).sort((a, b) => a.order - b.order);
}

export async function getExperiences(): Promise<Experience[]> {
  noStore();
  return (await readCollection<Experience>("experience", experienceSchema)).sort((a, b) => a.order - b.order);
}

export async function getEngineeringCases(): Promise<EngineeringCase[]> {
  noStore();
  return (await readCollection<EngineeringCase>("engineering", engineeringCaseSchema)).sort((a, b) => a.order - b.order);
}

export async function getPublishedEngineeringCases() {
  return (await getEngineeringCases()).filter((item) => item.status === "published");
}

export async function getSettings(): Promise<SiteSettings> {
  noStore();
  const [value] = await listCollection("settings");
  const parsed = siteSettingsSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (value) console.error("[content] Invalid site settings", parsed.error);
  return {
    name: "Gyuri Kim",
    role: "Frontend Developer",
    heroIntroduction: "",
    coreStack: [],
    resumeUrl: "",
    githubUrl: "",
    email: "",
    featuredProjectIds: [],
    about: "",
    contact: "",
    seoTitle: "Gyuri Kim — Frontend Developer",
    seoDescription: "Frontend developer portfolio",
  };
}
