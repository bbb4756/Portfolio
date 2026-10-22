"use client";

import { useCallback, useEffect, useRef } from "react";

type Spring = {
  value: number;
  velocity: number;
  target: number;
};

type GlyphState = {
  x: Spring;
  y: Spring;
  weight: Spring;
  gap: Spring;
};

const createSpring = (value: number): Spring => ({ value, velocity: 0, target: value });

function tickSpring(spring: Spring) {
  spring.velocity = (spring.velocity + (spring.target - spring.value) * 0.085) * 0.81;
  spring.value += spring.velocity;
  return Math.abs(spring.target - spring.value) > 0.01 || Math.abs(spring.velocity) > 0.01;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [name.trim(), ""];
  return [parts[0], parts.slice(1).join(" ")];
}

function GlyphLine({ text, offset = false }: { text: string; offset?: boolean }) {
  return (
    <span className={`magnetic-name-line${offset ? " magnetic-name-line-offset" : ""}`} aria-hidden="true">
      {[...text].map((character, index) => (
        <span className="magnetic-glyph" data-magnetic-glyph key={`${character}-${index}`}>
          {character === " " ? "\u00a0" : character}
        </span>
      ))}
    </span>
  );
}

export function MagneticHero({
  name,
  role,
  introduction,
  stack,
}: {
  name: string;
  role: string;
  introduction: string;
  stack: string[];
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const statesRef = useRef<GlyphState[]>([]);
  const frameRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [firstName, lastName] = splitName(name);

  const paint = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const glyphs = Array.from(stage.querySelectorAll<HTMLElement>("[data-magnetic-glyph]"));
    glyphs.forEach((glyph, index) => {
      const state = statesRef.current[index];
      if (!state) return;
      glyph.style.setProperty("--magnetic-x", `${state.x.value.toFixed(2)}px`);
      glyph.style.setProperty("--magnetic-y", `${state.y.value.toFixed(2)}px`);
      glyph.style.setProperty("--magnetic-weight", state.weight.value.toFixed(2));
      glyph.style.setProperty("--magnetic-gap", `${state.gap.value.toFixed(2)}px`);
    });
  }, []);

  const animate = useCallback(() => {
    if (frameRef.current) return;
    const tick = () => {
      let moving = false;
      statesRef.current.forEach((state) => {
        [state.x, state.y, state.weight, state.gap].forEach((spring) => {
          moving = tickSpring(spring) || moving;
        });
      });
      paint();
      frameRef.current = moving ? requestAnimationFrame(tick) : 0;
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [paint]);

  const reset = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    statesRef.current.forEach((state) => {
      state.x.target = state.x.value = 0;
      state.y.target = state.y.value = 0;
      state.weight.target = state.weight.value = 620;
      state.gap.target = state.gap.value = 0;
      state.x.velocity = state.y.velocity = state.weight.velocity = state.gap.velocity = 0;
    });
    stage.classList.remove("is-engaged");
    paint();
  }, [paint]);

  const reactToPoint = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const glyphs = Array.from(stage.querySelectorAll<HTMLElement>("[data-magnetic-glyph]"));
    glyphs.forEach((glyph, index) => {
      const rect = glyph.getBoundingClientRect();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      const influence = Math.max(0, 1 - distance / 300);
      const near = distance < 92;
      const force = influence * (near ? -18 : 11);
      const state = statesRef.current[index];
      if (!state) return;
      state.x.target = (dx / Math.max(distance, 1)) * force;
      state.y.target = (dy / Math.max(distance, 1)) * force * 0.72;
      state.weight.target = 620 + influence * 55;
      state.gap.target = influence * (near ? 5.5 : 2.5);
    });
    const rect = stage.getBoundingClientRect();
    stage.style.setProperty("--magnetic-pointer-x", `${clientX - rect.left}px`);
    stage.style.setProperty("--magnetic-pointer-y", `${clientY - rect.top}px`);
    stage.classList.add("is-engaged");
    animate();
  }, [animate]);

  const replay = useCallback((x = 0.42, y = 0.52) => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = stage.getBoundingClientRect();
    reactToPoint(rect.left + rect.width * x, rect.top + rect.height * y);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(reset, 760);
  }, [reactToPoint, reset]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const glyphCount = stage.querySelectorAll("[data-magnetic-glyph]").length;
    statesRef.current = Array.from({ length: glyphCount }, () => ({
      x: createSpring(0),
      y: createSpring(0),
      weight: createSpring(620),
      gap: createSpring(0),
    }));
    paint();
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [name, paint]);

  return (
    <section className="magnetic-hero" aria-labelledby="hero-title">
      <div className="hero-meta"><span>Portfolio / 2027</span><span>Seoul, KR</span></div>
      <div
        className="magnetic-name-stage"
        ref={stageRef}
        tabIndex={0}
        role="group"
        aria-describedby="magnetic-instructions"
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          reactToPoint(event.clientX, event.clientY);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") reset();
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          reactToPoint(event.clientX, event.clientY);
          if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
          resetTimerRef.current = setTimeout(reset, 620);
        }}
        onTouchStart={(event) => {
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          const touch = event.touches[0];
          if (!touch) return;
          reactToPoint(touch.clientX, touch.clientY);
          if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
          resetTimerRef.current = setTimeout(reset, 620);
        }}
        onKeyDown={(event) => {
          const positions: Record<string, [number, number]> = {
            ArrowLeft: [0.25, 0.5], ArrowRight: [0.75, 0.5], ArrowUp: [0.5, 0.28], ArrowDown: [0.5, 0.72],
          };
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            replay();
          } else if (positions[event.key]) {
            event.preventDefault();
            replay(...positions[event.key]);
          } else if (event.key === "Escape") reset();
        }}
      >
        <h1 className="magnetic-name" id="hero-title" aria-label={name}>
          <GlyphLine text={firstName} />
          {lastName && <GlyphLine text={lastName} offset />}
        </h1>
        <span className="magnetic-pointer-field" aria-hidden="true"><i /></span>
        <span className="sr-only" id="magnetic-instructions">포인터를 움직이거나 Enter 또는 방향키를 누르면 이름의 글자가 반응합니다.</span>
      </div>
      <div className="magnetic-hero-footer">
        <p className="magnetic-role">{role}</p>
        <p>{introduction}</p>
        <p className="magnetic-stack">{stack.join(" / ")}</p>
        <a className="magnetic-jump" href="#work"><span>Explore selected work</span><span aria-hidden="true">↘</span></a>
      </div>
    </section>
  );
}
