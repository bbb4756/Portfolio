import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EngineeringProse } from "@/components/EngineeringProse";
import { EngineeringReveal } from "@/components/EngineeringReveal";
import { SiteHeader } from "@/components/SiteHeader";
import { DeviceShowcase } from "@/components/MediaStage";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { getMedia, getPublishedEngineeringCases, getPublishedProjects } from "@/lib/content";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const cases = await getPublishedEngineeringCases();
  const { slug } = await params;
  const item = cases.find((entry) => entry.slug === slug);
  return item ? { title: `${item.title} — Engineering Case`, description: item.summary || item.background } : {};
}

export default async function EngineeringDetail({ params }: { params: Promise<{ slug: string }> }) {
  const [cases, projects, media] = await Promise.all([getPublishedEngineeringCases(), getPublishedProjects(), getMedia()]);
  const { slug } = await params;
  const index = cases.findIndex((entry) => entry.slug === slug);
  const item = cases[index];
  if (!item) notFound();
  const previous = cases[(index - 1 + cases.length) % cases.length];
  const next = cases[(index + 1) % cases.length];
  const linkedProjects = item.projectIds.map((id) => projects.find((project) => project.id === id)).filter((project) => project !== undefined);
  const sections = [
    ["Background", item.background, "background"],
    ["Constraints", item.constraints, "constraints"],
    ["Investigation", item.rootCause, "investigation"],
    [item.alternatives.length > 0 ? "Technical decision" : "Approach", item.solution, "decision"],
    ["Implementation", item.implementation, "implementation"],
    ["Verification", item.verification, "verification"],
    ["Result", item.result, "result"],
    ["Learnings", item.learnings, "learnings"],
  ] as const;
  return <><SiteHeader /><main id="main" className="engineering-page engineering-detail"><EngineeringReveal /><header className="engineering-case-hero"><div className="engineering-case-top"><p className="eyebrow">{String(index + 1).padStart(2, "0")} / {String(cases.length).padStart(2, "0")} · Engineering Case</p><Link href="/engineering">All cases ↗</Link></div><h1>{item.title}</h1><div className="engineering-case-intro"><p>{item.summary}</p><div><span>Stack</span><p>{item.technologies.join(" · ")}</p></div>{linkedProjects.length > 0 && <div><span>Project</span>{linkedProjects.map((project) => <Link key={project.id} href={`/projects/${project.slug}`}>{project.name} ↗</Link>)}</div>}</div></header><div className="engineering-case-body">{sections.map(([title, body, variant]) => body ? <section className={`engineering-case-section engineering-section-${variant}`} key={title}><p className="eyebrow">{title}</p><EngineeringProse>{body}</EngineeringProse></section> : null)}{item.alternatives.length > 0 && <section className="engineering-case-section engineering-alternatives"><p className="eyebrow">Options considered</p><ol>{item.alternatives.map((alternative, optionIndex) => <li key={alternative}><span>{String(optionIndex + 1).padStart(2, "0")}</span><EngineeringProse>{alternative}</EngineeringProse></li>)}</ol></section>}{item.diagram && <section className="engineering-case-section engineering-diagram"><p className="eyebrow">System flow</p><MermaidDiagram source={item.diagram} /></section>}{item.mediaIds.length > 0 && <section className="engineering-case-section engineering-media"><p className="eyebrow">Related media</p><DeviceShowcase mediaIds={item.mediaIds} media={media} preset="browser" /></section>}{item.code && <section className="engineering-case-section engineering-code"><p className="eyebrow">Code</p><pre><code>{item.code}</code></pre></section>}</div><nav className="engineering-case-pagination" aria-label="Engineering case navigation"><Link href={`/engineering/${previous.slug}`}><span>Previous case</span>{previous.title}</Link><Link href={`/engineering/${next.slug}`}><span>Next case</span>{next.title}</Link></nav></main></>;
}
