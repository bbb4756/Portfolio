/* eslint-disable @next/next/no-img-element -- This isolated lab uses CMS-managed poster URLs directly. */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";

type LabMedia = { id: string; src: string; alt: string; width: number; height: number };

function LabPhone({ item, className = "" }: { item: LabMedia; className?: string }) {
  return <figure className={`lab-phone ${className}`}><div className="lab-phone-screen"><img src={item.src} alt={item.alt} width={item.width || undefined} height={item.height || undefined} /></div></figure>;
}

function DragTrack({ items }: { items: LabMedia[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false, dragging: false });
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;
    dragRef.current = { active: true, startX: event.clientX, scrollLeft: track.scrollLeft };
    track.setPointerCapture(event.pointerId);
    setCursor((value) => ({ ...value, dragging: true }));
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const bounds = event.currentTarget.getBoundingClientRect();
    setCursor({ x: event.clientX - bounds.left, y: event.clientY - bounds.top, visible: event.pointerType === "mouse", dragging: dragRef.current.active });
    if (track && dragRef.current.active) track.scrollLeft = dragRef.current.scrollLeft - (event.clientX - dragRef.current.startX) * 1.15;
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setCursor((value) => ({ ...value, dragging: false }));
  };
  return (
    <div className="lab-track-shell" onPointerMove={onPointerMove} onPointerLeave={() => setCursor((value) => ({ ...value, visible: false }))}>
      <div ref={trackRef} className="lab-track" onPointerDown={onPointerDown} onPointerUp={finish} onPointerCancel={finish}>
        {items.map((item, index) => <article key={item.id} className="lab-track-card"><span>0{index + 1}</span><LabPhone item={item} /><p>{item.alt}</p></article>)}
      </div>
      <span className={`lab-drag-cursor${cursor.visible ? " is-visible" : ""}${cursor.dragging ? " is-dragging" : ""}`} style={{ "--cursor-x": `${cursor.x}px`, "--cursor-y": `${cursor.y}px` } as CSSProperties}>{cursor.dragging ? "HOLD" : "DRAG"}</span>
    </div>
  );
}

function ScrollStory({ items }: { items: LabMedia[] }) {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const centered = entries.filter((entry) => entry.isIntersecting).sort((a, b) => Math.abs(a.boundingClientRect.top + a.boundingClientRect.height / 2 - window.innerHeight / 2) - Math.abs(b.boundingClientRect.top + b.boundingClientRect.height / 2 - window.innerHeight / 2))[0];
      if (centered) setActive(Number((centered.target as HTMLElement).dataset.index));
    }, { rootMargin: "-35% 0px -35%", threshold: 0.05 });
    stepRefs.current.forEach((step) => step && observer.observe(step));
    return () => observer.disconnect();
  }, []);
  return (
    <div className="lab-story-grid">
      <div className="lab-story-stage" aria-live="polite">
        <div className="lab-story-stack" style={{ transform: `translate3d(0, -${active * 100}%, 0)` }}>
          {items.map((item) => <div key={item.id} className="lab-story-frame"><LabPhone item={item} /></div>)}
        </div>
        <span className="lab-story-index">0{active + 1} / 0{items.length}</span>
      </div>
      <div className="lab-story-steps">
        {items.map((item, index) => <article key={item.id} ref={(element) => { stepRefs.current[index] = element; }} data-index={index} className={active === index ? "is-active" : ""}><span>Scene 0{index + 1}</span><p>{item.alt}</p></article>)}
      </div>
    </div>
  );
}

function MediaLens({ items }: { items: LabMedia[] }) {
  const [lens, setLens] = useState({ x: 50, y: 50, active: false, locked: false });
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
    setLens((value) => ({ ...value, x, y, active: true }));
  };
  const toggleTouch = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    move(event);
    setLens((value) => ({ ...value, active: !value.locked, locked: !value.locked }));
  };
  return (
    <div className="lab-lens-grid">
      <div className="lab-lens-stage" onPointerMove={move} onPointerEnter={move} onPointerLeave={() => setLens((value) => value.locked ? value : { ...value, active: false })} onPointerDown={toggleTouch} style={{ "--lens-x": `${lens.x}%`, "--lens-y": `${lens.y}%`, "--lens-size": lens.active ? "116px" : "0px" } as CSSProperties}>
        <LabPhone item={items[0]} className="lab-lens-phone" />
        <div className="lab-lens-overlay" aria-hidden="true"><LabPhone item={items[1]} className="lab-lens-phone" /></div>
        <span className="lab-lens-ring" aria-hidden="true" />
      </div>
      <div className="lab-lens-copy"><span>Base / 01</span><p>{items[0].alt}</p><span>Lens / 02</span><p>{items[1].alt}</p></div>
    </div>
  );
}

function InteractionSpec({ reference, location, input, start, end }: { reference: string; location: string; input: string; start: string; end: string }) {
  return <dl className="lab-spec"><div><dt>Reference translation</dt><dd>{reference}</dd></div><div><dt>Applied to</dt><dd>{location}</dd></div><div><dt>Input</dt><dd>{input}</dd></div><div><dt>Start → End</dt><dd>{start} → {end}</dd></div></dl>;
}

export function OndajiMotionLab({ projectName, items }: { projectName: string; items: LabMedia[] }) {
  return (
    <main className="motion-lab" id="main">
      <header className="motion-lab-header"><div><p className="eyebrow">Independent prototype / 03 studies</p><h1>{projectName}<br />Motion Lab</h1></div><div className="motion-lab-nav"><a href="#track">01 Drag track</a><a href="#story">02 Scroll story</a><a href="#lens">03 Media lens</a><Link href="/projects/ondaji">Back to case study ↗</Link></div></header>
      <section className="lab-study" id="track"><header><span>01</span><h2>Directed media track</h2><p>프로젝트 화면을 장식처럼 흘리지 않고, 사용자가 직접 순서와 속도를 제어하는 미디어 인덱스입니다.</p></header><DragTrack items={items} /><InteractionSpec reference="BASIC/DEPT Featured Work의 DRAG 피드백 + Codrops Thumbnail Flow의 선택 구조" location="상세 Hero 다음 실제 서비스 미디어 인덱스" input="포인터 드래그 / 터치 스와이프" start="세 화면이 한 트랙에 정렬" end="가장 가까운 화면이 중앙에 스냅" /></section>
      <section className="lab-study" id="story"><header><span>02</span><h2>Scene-linked scroll</h2><p>텍스트 자체를 등장시키지 않고, 읽고 있는 장면과 실제 앱 화면의 위치만 연결합니다.</p></header><ScrollStory items={items} /><InteractionSpec reference="Locomotive Featured Work의 대형 프로젝트 인덱스와 미디어 전환" location="문제 해결 과정 또는 기능 흐름 3단계" input="일반 세로 스크롤" start="첫 장면과 첫 화면이 정렬" end="마지막 장면에서 마지막 화면으로 수직 이동 완료" /></section>
      <section className="lab-study" id="lens"><header><span>03</span><h2>Adjacent screen lens</h2><p>한 화면을 유지한 채, 포인터 주변에서만 연결된 다음 화면을 살펴보는 국소 탐색입니다.</p></header><MediaLens items={items} /><InteractionSpec reference="Codrops Pointer Square Lens의 입력 범위와 추적 감각 — 왜곡과 RGB shift는 제외" location="디바이스 상세 관찰 또는 Before/After 비교" input="포인터 이동 / 터치 탭" start="기준 화면 전체 노출" end="포인터 이탈 또는 재탭 시 기준 화면으로 복귀" /></section>
      <footer className="motion-lab-footer"><p>이 화면은 비교용 프로토타입이며 공개 케이스 스터디와 CMS 데이터에는 영향을 주지 않습니다.</p><Link href="/projects/ondaji">Return to Ondaji ↗</Link></footer>
    </main>
  );
}
