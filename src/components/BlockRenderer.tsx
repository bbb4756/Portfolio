import Link from "next/link";
import type { CaseStudyBlock, MediaItem, Project } from "@/lib/schema";
import { DeviceShowcase, PlayableMedia } from "./MediaStage";
import { MermaidDiagram } from "./MermaidDiagram";

export function BlockRenderer({ block, media, projects, projectSlug, interactiveArchitecture = false }: { block: CaseStudyBlock; media: MediaItem[]; projects: Project[]; projectSlug?: string; interactiveArchitecture?: boolean }) {
  if (block.type === "text") return <section className={`case-block prose-block preset-${block.preset}`}><p className="eyebrow">Narrative</p>{block.title && <h2>{block.title}</h2>}<p>{block.body}</p>{block.emphasis && <strong>{block.emphasis}</strong>}</section>;
  if (block.type === "image" || block.type === "video") {
    const item = media.find((entry) => entry.id === block.mediaId);
    if (!item) return null;
    return <section className={`case-block media-block preset-${block.preset}`}>{block.type === "video" ? <PlayableMedia item={item} /> : <DeviceShowcase mediaIds={[item.id]} media={media} preset="browser" />}{block.caption && <p className="caption">{block.caption}</p>}</section>;
  }
  if (block.type === "gallery") return <section className={`case-block gallery-block preset-${block.preset}`}><DeviceShowcase mediaIds={block.mediaIds} media={media} preset="browser" /></section>;
  if (block.type === "device-showcase") return <section className="case-block device-case"><div className="block-intro"><p className="eyebrow">{projectSlug === "ondaji" ? "Core user flow" : "Media direction"}</p>{block.title && <h2>{block.title}</h2>}<p>{block.body}</p></div><DeviceShowcase mediaIds={block.mediaIds} media={media} preset={block.preset} /></section>;
  if (block.type === "problem-solution") return <section className="case-block split-block problem-solution-block"><div><p className="eyebrow">Problem</p><p>{block.problem}</p></div><div><p className="eyebrow">Solution</p><p>{block.solution}</p></div></section>;
  if (block.type === "technical-decision") return <section className="case-block decision-block"><p className="eyebrow">Technical decision</p><h2>{block.title}</h2><p>{block.context}</p>{block.options.length > 0 && <ul>{block.options.map((item) => <li key={item}>{item}</li>)}</ul>}<h3>Decision</h3><p>{block.decision}</p><p>{block.rationale}</p></section>;
  if (block.type === "architecture") return <section className="case-block architecture-block">{block.preset === "mermaid" && block.mermaid ? <MermaidDiagram source={block.mermaid} interactive={interactiveArchitecture} /> : <DeviceShowcase mediaIds={block.mediaId ? [block.mediaId] : []} media={media} preset="browser" />}{block.caption && <p className="caption">{block.caption}</p>}</section>;
  if (block.type === "code") return <section className="case-block code-block"><div className="code-label">{block.language}</div><pre><code>{block.code}</code></pre>{block.caption && <p className="caption">{block.caption}</p>}</section>;
  if (block.type === "metrics") return <section className="case-block metrics-block">{block.items.map((item) => <article key={`${item.label}-${item.value}`}><strong>{item.value}</strong><span>{item.label}</span>{item.evidence && <small>{item.evidence}</small>}</article>)}</section>;
  if (block.type === "timeline") return <section className="case-block timeline-block">{projectSlug === "ondaji" && <p className="eyebrow">My Contributions</p>}{block.items.map((item) => <article key={`${item.period}-${item.title}`}><span>{item.period}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}</section>;
  if (block.type === "before-after") return <section className="case-block split-block"><DeviceShowcase mediaIds={[block.beforeMediaId]} media={media} preset="browser" /><DeviceShowcase mediaIds={[block.afterMediaId]} media={media} preset="browser" /><p>{block.description}</p></section>;
  if (block.type === "callout") return <aside className={`case-block callout preset-${block.preset}`}><p className="eyebrow">{block.title}</p><p>{block.body}</p></aside>;
  if (block.type === "related-projects") return <section className="case-block related-block"><p className="eyebrow">Related projects</p>{block.projectIds.map((id) => { const project = projects.find((item) => item.id === id); return project ? <Link key={id} href={`/projects/${project.slug}`}>{project.name} ↗</Link> : null; })}</section>;
  return null;
}
