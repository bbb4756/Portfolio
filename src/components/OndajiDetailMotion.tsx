"use client";

import { useEffect } from "react";

const observedSelectors = [
  ".detail-introduction",
  ".detail-stage",
  ".case-study > .case-block",
  ".project-pagination",
].join(",");

export function OndajiDetailMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.detail-page[data-project="ondaji"]');
    if (!root) return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>(observedSelectors));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) return;

    let observer: IntersectionObserver | undefined;
    let readyFrame = 0;
    try {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const section = entry.target as HTMLElement;
          section.classList.add("is-revealed");
          observer?.unobserve(section);
        });
      }, { rootMargin: "0px 0px -10%", threshold: 0.12 });

      sections.forEach((section) => {
        section.classList.add("ondaji-reveal");
        if (section.getBoundingClientRect().top < window.innerHeight * 0.9) {
          section.classList.add("is-revealed");
          return;
        }
        observer?.observe(section);
      });

      readyFrame = window.requestAnimationFrame(() => {
        root.dataset.revealReady = "true";
      });
    } catch {
      observer?.disconnect();
      sections.forEach((section) => section.classList.remove("ondaji-reveal", "is-revealed"));
      delete root.dataset.revealReady;
    }

    return () => {
      observer?.disconnect();
      if (readyFrame) window.cancelAnimationFrame(readyFrame);
      delete root.dataset.revealReady;
    };
  }, []);

  return null;
}
