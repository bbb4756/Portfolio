import Link from "next/link";
import { getExperiences, getMedia, getPublishedEngineeringCases, getPublishedProjects, getSettings } from "@/lib/content";
import { SiteHeader } from "@/components/SiteHeader";
import { MagneticHero } from "@/components/MagneticHero";
import { EditorialWork } from "@/components/EditorialWork";

export default async function Home() {
  const [settings, projects, media, experiences, cases] = await Promise.all([getSettings(), getPublishedProjects(), getMedia(), getExperiences(), getPublishedEngineeringCases()]);
  const selected = settings.featuredProjectIds.length > 0
    ? settings.featuredProjectIds.map((id) => projects.find((project) => project.id === id)).filter((project) => project !== undefined).slice(0, 3)
    : projects.filter((project) => project.showOnHome).slice(0, 3);
  return <>
    <SiteHeader />
    <main id="main">
      <MagneticHero name={settings.name} role={settings.role} introduction={settings.heroIntroduction} stack={settings.coreStack} />
      <EditorialWork projects={selected} media={media} />
      <section className="focus-section">
        <p className="eyebrow">02 / Engineering Focus</p>
        <div className="focus-grid"><article><span>01</span><h3>Platform &amp; Migration</h3></article><article><span>02</span><h3>Web &amp; Native Integration</h3></article><article><span>03</span><h3>Architecture &amp; Reliability</h3></article></div>
        {cases.length > 0 && <Link href="/engineering" className="text-link">Read engineering cases ↗</Link>}
      </section>
      <section className="experience-section" id="experience">
        <p className="eyebrow">03 / Experience</p>
        {settings.about && <p className="about-copy">{settings.about}</p>}
        {experiences.map((experience) => <article key={experience.id}><p>{experience.period}</p><h3>{experience.company}</h3><p>{experience.role}</p></article>)}
      </section>
      <section className="contact-section" id="contact"><p className="eyebrow">04 / Contact</p><h2>Let&apos;s build<br />something useful.</h2><p>{settings.contact}</p><div className="contact-links">{settings.email && <a href={`mailto:${settings.email}`}>{settings.email} ↗</a>}{settings.githubUrl && <a href={settings.githubUrl} target="_blank" rel="noreferrer">GitHub ↗</a>}{settings.resumeUrl && <a href={settings.resumeUrl} target="_blank" rel="noreferrer">Résumé ↗</a>}</div></section>
    </main>
  </>;
}
