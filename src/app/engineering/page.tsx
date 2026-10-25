import Link from "next/link";
import { EngineeringReveal } from "@/components/EngineeringReveal";
import { SiteHeader } from "@/components/SiteHeader";
import { getPublishedEngineeringCases } from "@/lib/content";

function firstResult(value: string) {
  return value.split("\n").map((line) => line.trim().replace(/^[-*]\s*/, "").replace(/\*\*|`/g, "")).find(Boolean) ?? "";
}

export default async function EngineeringPage() {
  const cases = await getPublishedEngineeringCases();
  return <><SiteHeader /><main id="main" className="engineering-page engineering-index"><EngineeringReveal /><header className="engineering-index-hero"><p className="eyebrow">Engineering Cases / {String(cases.length).padStart(2, "0")}</p><h1>Engineering<br />Cases.</h1><p>서비스 개발과 운영 과정에서 수행한 주요 기술 개선 사례입니다. 문제 분석, 기술적 의사결정, 구현 및 검증 결과를 중심으로 정리했습니다.</p></header>{cases.length === 0 ? <div className="empty-state"><p>아직 공개된 Engineering Case가 없습니다.</p><span>관리자에서 Draft를 완성한 뒤 Published로 전환하면 이 목록에 나타납니다.</span></div> : <section className="engineering-list" aria-label="Engineering case studies">{cases.map((item, index) => <Link href={`/engineering/${item.slug}`} key={item.id}><span className="engineering-list-index">{String(index + 1).padStart(2, "0")}</span><div className="engineering-list-main"><div className="engineering-tech-list" aria-label="Technologies">{item.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div><h2>{item.title}</h2><p>{item.summary}</p></div><div className="engineering-list-result"><span>Key result</span><p>{firstResult(item.result)}</p></div><span className="engineering-list-arrow" aria-hidden="true">↗</span></Link>)}</section>}</main></>;
}
