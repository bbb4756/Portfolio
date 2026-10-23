"use client";

import { useEffect } from "react";

const observedSelectors = [
  ".detail-introduction",
  ".prose-block",
  ".device-case",
  ".problem-solution-block",
  ".architecture-block",
  ".decision-block",
  ".metrics-block",
  ".callout",
].join(",");

export function OndajiDetailMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.detail-page[data-project="ondaji"]');
    if (!root) return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>(observedSelectors));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.dataset.motionReady = reducedMotion ? "reduced" : "true";

    if (reducedMotion) {
      sections.forEach((section) => section.classList.add("has-entered"));
      return () => { delete root.dataset.motionReady; };
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add("has-entered");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -14%", threshold: 0.16 });
    sections.forEach((section) => observer.observe(section));

    const story = root.querySelector<HTMLElement>(".device-case");
    let storyVisible = false;
    let frame = 0;
    const updateStory = () => {
      frame = 0;
      if (!story || !storyVisible || root.classList.contains("media-is-playing")) return;
      const rect = story.getBoundingClientRect();
      const travel = window.innerHeight + rect.height;
      const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / travel));
      story.style.setProperty("--story-progress", progress.toFixed(3));
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateStory);
    };
    const storyObserver = story ? new IntersectionObserver(([entry]) => {
      storyVisible = entry.isIntersecting;
      requestUpdate();
    }, { rootMargin: "20% 0px" }) : null;
    if (story && storyObserver) storyObserver.observe(story);
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    const videos = Array.from(root.querySelectorAll<HTMLVideoElement>("video"));
    const syncPlayback = () => {
      root.classList.toggle("media-is-playing", videos.some((video) => !video.paused && !video.ended));
      requestUpdate();
    };
    videos.forEach((video) => {
      video.addEventListener("play", syncPlayback);
      video.addEventListener("pause", syncPlayback);
      video.addEventListener("ended", syncPlayback);
    });

    requestUpdate();
    return () => {
      observer.disconnect();
      storyObserver?.disconnect();
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
      videos.forEach((video) => {
        video.removeEventListener("play", syncPlayback);
        video.removeEventListener("pause", syncPlayback);
        video.removeEventListener("ended", syncPlayback);
      });
      story?.style.removeProperty("--story-progress");
      root.classList.remove("media-is-playing");
      delete root.dataset.motionReady;
    };
  }, []);

  return null;
}
