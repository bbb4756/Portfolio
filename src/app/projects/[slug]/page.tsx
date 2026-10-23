import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlockRenderer } from "@/components/BlockRenderer";
import { MediaStage } from "@/components/MediaStage";
import { OndajiDetailMotion } from "@/components/OndajiDetailMotion";
import { SiteHeader } from "@/components/SiteHeader";
import { getMedia, getProjectBySlug, getPublishedEngineeringCases, getPublishedProjects } from "@/lib/content";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const project = await getProjectBySlug((await params).slug);
  return project ? { title: project.seoTitle || project.name, description: project.seoDescription || project.oneLiner } : {};
}

export default async function ProjectDetail({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const [project, media, projects, engineeringCases] = await Promise.all([getProjectBySlug(slug), getMedia(), getPublishedProjects(), getPublishedEngineeringCases()]);
  if (!project) notFound();
  const index = projects.findIndex((item) => item.id === project.id);
  const previous = projects[(index - 1 + projects.length) % projects.length];
  const next = projects[(index + 1) % projects.length];
  const relatedCases = project.engineeringCaseIds.map((id) => engineeringCases.find((item) => item.id === id)).filter((item) => item !== undefined);
  const relatedProjects = project.relatedProjectIds.map((id) => projects.find((item) => item.id === id)).filter((item) => item !== undefined);
  const displayIndex = index >= 0 ? index + 1 : 1;
  return (
    <>
      <SiteHeader />
      <main id="main" className="detail-page" data-project={project.slug}>
        {project.slug === "ondaji" && <OndajiDetailMotion />}
        <header className="detail-hero">
          <div className="detail-hero-top">
            <p className="eyebrow">{String(displayIndex).padStart(2, "0")} / {String(projects.length).padStart(2, "0")} · {project.projectType} / {project.platform}</p>
            <Link href="/projects">All projects ↗</Link>
          </div>
          <h1>{project.name}</h1>
          <div className="detail-hero-bottom">
            <p className="detail-lead">{project.oneLiner}</p>
            <div className="detail-facts">
              {project.period && <div><span>Period</span><strong>{project.period}</strong></div>}
              {project.role && <div><span>Role</span><strong>{project.role}</strong></div>}
              {project.techStack.length > 0 && <div><span>Stack</span><strong>{project.techStack.join(" · ")}</strong></div>}
            </div>
          </div>
        </header>
        <section className="detail-stage" aria-label={`${project.name} project media`}>
          <div className="detail-stage-head" aria-hidden="true">
            <span>Selected media</span>
            <span>Actual product / M2</span>
          </div>
          <MediaStage project={project} media={media} interactive />
        </section>
        {project.detailedIntroduction && (
          <section className="detail-introduction">
            <p className="eyebrow">Overview</p>
            <p>{project.detailedIntroduction}</p>
          </section>
        )}
        <div className="case-study">
          {project.blocks.map((block) => <BlockRenderer key={block.id} block={block} media={media} projects={projects} interactiveArchitecture={project.slug === "ondaji"} />)}
          {relatedCases.length > 0 && <section className="case-block related-block"><p className="eyebrow">Engineering cases</p>{relatedCases.map((item) => <Link key={item.id} href={`/engineering/${item.slug}`}>{item.title} ↗</Link>)}</section>}
          {relatedProjects.length > 0 && <section className="case-block related-block"><p className="eyebrow">Related projects</p>{relatedProjects.map((item) => <Link key={item.id} href={`/projects/${item.slug}`}>{item.name} ↗</Link>)}</section>}
        </div>
        <nav className="project-pagination" aria-label="Project navigation">
          <Link href={`/projects/${previous.slug}`}><span>Previous project</span>{previous.name}</Link>
          <Link href={`/projects/${next.slug}`}><span>Next project</span>{next.name}</Link>
        </nav>
      </main>
    </>
  );
}
