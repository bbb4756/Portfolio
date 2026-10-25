"use client";

import { useEffect } from "react";

const selectors = [
  ".engineering-list > a",
  ".engineering-case-section",
  ".engineering-case-pagination",
].join(",");

export function EngineeringReveal() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".engineering-page");
    if (!root) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>(selectors));
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
      }, { rootMargin: "0px 0px -8%", threshold: 0.1 });

      sections.forEach((section) => {
        section.classList.add("engineering-reveal");
        if (section.getBoundingClientRect().top < window.innerHeight * 0.92) section.classList.add("is-revealed");
        else observer?.observe(section);
      });
      readyFrame = window.requestAnimationFrame(() => { root.dataset.revealReady = "true"; });
    } catch {
      observer?.disconnect();
      sections.forEach((section) => section.classList.remove("engineering-reveal", "is-revealed"));
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
