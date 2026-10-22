import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getPublishedEngineeringCases } from "@/lib/content";

export default async function EngineeringPage() {
  const cases = await getPublishedEngineeringCases();
  return <><SiteHeader /><main id="main" className="listing-page"><header className="listing-hero"><p className="eyebrow">Engineering Cases / {cases.length}</p><h1>Decisions,<br />not just outcomes.</h1><p>검증된 기술 사례만 공개합니다. 작성 중인 Draft는 방문자에게 표시되지 않습니다.</p></header>{cases.length === 0 ? <div className="empty-state"><p>아직 공개된 Engineering Case가 없습니다.</p><span>관리자에서 Draft를 완성한 뒤 Published로 전환하면 이 목록에 나타납니다.</span></div> : <div className="engineering-list">{cases.map((item, index) => <Link href={`/engineering/${item.slug}`} key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><h2>{item.title}</h2><p>{item.background}</p></Link>)}</div>}</main></>;
}

