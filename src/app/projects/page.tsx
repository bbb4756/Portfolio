import Link from "next/link";
import { getMedia, getPublishedProjects } from "@/lib/content";
import { SiteHeader } from "@/components/SiteHeader";
import { MediaStage } from "@/components/MediaStage";

export default async function ProjectsPage() {
  const [projects, media] = await Promise.all([getPublishedProjects(), getMedia()]);
  return <><SiteHeader /><main id="main" className="listing-page"><header className="listing-hero"><p className="eyebrow">Project Index / {projects.length}</p><h1>Selected<br />and archived work.</h1><p>플랫폼과 프로젝트 유형에 따라 실제 미디어를 다른 방식으로 보여줍니다.</p></header><div className="all-projects">{projects.map((project, index) => {
    const archive = project.slug === "early-frontend-archive";
    const curatedMultiDevice = project.slug === "donbangseok";
    const archiveCount = new Set([project.presentation.featuredMediaId, ...project.presentation.mediaIds].filter(Boolean)).size;
    return <article key={project.id} data-project={project.slug}><div className="project-number">{String(index + 1).padStart(2, "0")}</div><Link className="project-list-media" href={`/projects/${project.slug}`}><MediaStage project={project} media={media} restrained={archive || curatedMultiDevice} />{archive && <span className="project-archive-count">Archive frames · {String(archiveCount).padStart(2, "0")}</span>}</Link><div><p className="project-type">{project.projectType} / {project.platform}</p><h2><Link href={`/projects/${project.slug}`}>{project.name}</Link></h2><p>{project.oneLiner}</p></div></article>;
  })}</div></main></>;
}
