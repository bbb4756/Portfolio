"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { MediaItem, Project } from "@/lib/schema";
import { MediaStage } from "@/components/MediaStage";

export function EditorialWork({ projects, media }: { projects: Project[]; media: MediaItem[] }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const projects = Array.from(list.querySelectorAll<HTMLElement>("[data-editorial-project]"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const update = () => {
      frame = 0;
      const viewportHeight = window.innerHeight;
      projects.forEach((project) => {
        const rect = project.getBoundingClientRect();
        const progress = reduced.matches ? 1 : Math.min(1, Math.max(0, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
        project.style.setProperty("--editorial-progress", progress.toFixed(4));
      });
    };
    const requestUpdate = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    reduced.addEventListener("change", requestUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      reduced.removeEventListener("change", requestUpdate);
    };
  }, [projects]);

  return (
    <section className="editorial-work" id="work" aria-labelledby="selected-work-title">
      <header className="editorial-work-heading">
        <p className="eyebrow">01 / Selected Work</p>
        <h2 id="selected-work-title"><span>Selected</span><span>Work</span></h2>
      </header>
      <div className="editorial-work-list" ref={listRef}>
        {projects.map((project, index) => (
          <article className={`editorial-project editorial-project-${index + 1}`} data-editorial-project key={project.id}>
            <Link href={`/projects/${project.slug}`} className="editorial-project-media">
              <MediaStage project={project} media={media} restrained />
            </Link>
            <div className="editorial-project-copy">
              <span>{String(index + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span>
              <h3><Link href={`/projects/${project.slug}`}>{project.name}</Link></h3>
              {project.subtitle && <small>{project.subtitle}</small>}
              <p>{project.listDescription}</p>
              <div className="tag-list">{project.techStack.map((tag) => <span key={tag}>{tag}</span>)}</div>
            </div>
          </article>
        ))}
      </div>
      <Link href="/projects" className="text-link">View all projects ↗</Link>
    </section>
  );
}
