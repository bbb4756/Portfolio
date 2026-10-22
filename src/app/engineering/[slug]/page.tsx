import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { DeviceShowcase } from "@/components/MediaStage";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { getMedia, getPublishedEngineeringCases, getPublishedProjects } from "@/lib/content";

export default async function EngineeringDetail({ params }: { params: Promise<{ slug: string }> }) {
  const [cases, projects, media] = await Promise.all([getPublishedEngineeringCases(), getPublishedProjects(), getMedia()]);
  const { slug } = await params;
  const item = cases.find((entry) => entry.slug === slug);
  if (!item) notFound();
  const sections = [["Problem background", item.background], ["Constraints", item.constraints], ["Root cause", item.rootCause], ["Selected solution", item.solution], ["Implementation", item.implementation], ["Verification", item.verification], ["Result", item.result], ["Learnings", item.learnings]].filter(([, value]) => value);
  return <><SiteHeader /><main id="main" className="engineering-detail"><header><p className="eyebrow">Engineering Case</p><h1>{item.title}</h1><div className="tag-list">{item.projectIds.map((id) => { const project = projects.find((entry) => entry.id === id); return project ? <Link key={id} href={`/projects/${project.slug}`}>{project.name} ↗</Link> : null; })}</div></header>{sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}{item.alternatives.length > 0 && <section><h2>Alternatives considered</h2><ol>{item.alternatives.map((alternative) => <li key={alternative}>{alternative}</li>)}</ol></section>}{item.mediaIds.length > 0 && <section className="engineering-media"><h2>Related media</h2><DeviceShowcase mediaIds={item.mediaIds} media={media} preset="browser" /></section>}{item.diagram && <section><h2>Architecture</h2><MermaidDiagram source={item.diagram} /></section>}{item.code && <section><h2>Code</h2><pre><code>{item.code}</code></pre></section>}</main></>;
}
