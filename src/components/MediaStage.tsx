/* eslint-disable @next/next/no-img-element -- Direct sources are required for poster-to-GIF switching and repository-managed media. */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaItem, Project } from "@/lib/schema";

function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function MediaAsset({ item, active = false }: { item: MediaItem; active?: boolean }) {
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (imageRef.current?.complete && imageRef.current.naturalWidth === 0) setFailed(true);
  }, [active, item.file, item.poster]);
  useEffect(() => {
    const video = videoRef.current;
    if (item.kind !== "video" || !video) return;
    if (active) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [active, item.file, item.kind]);
  if (failed) return <div className="media-load-error" role="status">Media could not be loaded.</div>;
  if (item.kind === "video") {
    const shouldLoadSource = active || !item.poster;
    return <video ref={videoRef} aria-label={item.alt} controls={active} muted={item.muted} loop={item.loop} autoPlay={active} playsInline preload={shouldLoadSource ? "metadata" : "none"} poster={item.poster || undefined} src={shouldLoadSource ? item.file : undefined} onLoadedMetadata={() => {
      const video = videoRef.current;
      if (!video || active || item.poster || video.currentTime > 0) return;
      video.currentTime = Math.min(0.12, Number.isFinite(video.duration) ? video.duration / 2 : 0.12);
    }} onError={() => setFailed(true)} />;
  }
  if (item.kind === "gif" && !active && !item.poster) return <div className="media-poster-missing">Preview on request</div>;
  const source = item.kind === "gif" && !active ? item.poster : item.file;
  return <img ref={imageRef} src={source} alt={item.alt} width={item.originalWidth || undefined} height={item.originalHeight || undefined} loading="lazy" onError={() => setFailed(true)} />;
}

function visibilityClass(item: MediaItem) {
  if (item.showOnMobile && item.showOnDesktop) return "";
  if (item.showOnMobile) return "media-mobile-only";
  if (item.showOnDesktop) return "media-desktop-only";
  return "media-hidden";
}

function Phone({ item, active, size, frameStyle, targetClass }: { item: MediaItem; active?: boolean; size: Project["presentation"]["deviceSize"]; frameStyle: Project["presentation"]["frameStyle"]; targetClass?: string }) {
  const visibility = targetClass ?? visibilityClass(item);
  if (frameStyle === "none") return <figure className={`media-bare phone-${size} ${visibility}`}><MediaAsset item={item} active={active} /></figure>;
  return (
    <figure className={`phone phone-${size} frame-${frameStyle} ${visibility}`}>
      <span className="phone-button phone-button-one" />
      <span className="phone-button phone-button-two" />
      <div className="phone-screen"><MediaAsset item={item} active={active} /></div>
    </figure>
  );
}

function BrowserFrame({ item, active, frameStyle = "minimal-dark", targetClass }: { item: MediaItem; active?: boolean; frameStyle?: Project["presentation"]["frameStyle"]; targetClass?: string }) {
  const visibility = targetClass ?? visibilityClass(item);
  if (frameStyle === "none") return <figure className={`media-bare ${visibility}`}><MediaAsset item={item} active={active} /></figure>;
  return (
    <figure className={`browser-frame frame-${frameStyle} ${visibility}`}>
      <div className="browser-bar"><i /><i /><i /><span>project.local</span></div>
      <div className="browser-screen"><MediaAsset item={item} active={active} /></div>
    </figure>
  );
}

export function MediaStage({ project, media, interactive = false, restrained = false }: { project: Project; media: MediaItem[]; interactive?: boolean; restrained?: boolean }) {
  const reduced = useReducedMotion();
  const items = useMemo(() => {
    const ids = [project.presentation.featuredMediaId, ...project.presentation.mediaIds].filter((id, index, values) => id && values.indexOf(id) === index);
    return ids.map((id) => media.find((entry) => entry.id === id)).filter((entry) => entry && (entry.showOnMobile || entry.showOnDesktop)) as MediaItem[];
  }, [media, project.presentation.featuredMediaId, project.presentation.mediaIds]);
  const [playing, setPlaying] = useState(false);
  const expandedDesktop = ["multiple-phones", "gallery"].includes(project.presentation.layout);
  const desktopVisible = (restrained ? items.slice(0, 1) : expandedDesktop ? items : items.filter((item) => item.showOnDesktop).slice(0, 1)).filter((item) => item.showOnDesktop);
  const mobileCandidates = items.filter((item) => item.showOnMobile);
  const mobileVisible = restrained ? mobileCandidates.slice(0, 1) : project.presentation.mobilePreset === "single" ? mobileCandidates.slice(0, 1) : project.presentation.mobilePreset === "two-up" ? mobileCandidates.slice(0, 2) : mobileCandidates;
  const rendered = items.filter((item) => desktopVisible.includes(item) || mobileVisible.includes(item));
  if (!rendered.length) return <div className="media-empty">Media unavailable</div>;
  const phoneLayout = ["single-phone", "multiple-phones"].includes(project.presentation.layout) || ["native-app", "hybrid-app"].includes(project.presentation.platform);
  const bareLayout = project.presentation.layout === "full-bleed";
  return (
    <div className={`media-stage media-stage-${project.presentation.layout} align-${project.presentation.alignment} stage-bg-${project.presentation.background} fit-${project.presentation.imageFit} desktop-${project.presentation.desktopPreset} mobile-${project.presentation.mobilePreset}${restrained ? " media-stage-restrained" : ""}`}>
      <div className="media-stage-items">
        {rendered.map((item) => {
          const targetClass = `${desktopVisible.includes(item) ? "media-target-desktop" : ""} ${mobileVisible.includes(item) ? "media-target-mobile" : ""}`;
          return bareLayout ? <figure key={item.id} className={`media-bare ${targetClass}`}><MediaAsset item={item} active={playing && !reduced} /></figure> : phoneLayout ? <Phone key={item.id} item={item} active={playing && !reduced} size={project.presentation.deviceSize} frameStyle={project.presentation.frameStyle} targetClass={targetClass} /> : <BrowserFrame key={item.id} item={item} active={playing && !reduced} frameStyle={project.presentation.frameStyle} targetClass={targetClass} />;
        })}
      </div>
      {interactive && rendered.some((item) => item.kind !== "image") && (
        <button className="media-toggle" type="button" disabled={reduced} onClick={() => setPlaying((value) => !value)} aria-pressed={playing}>
          {reduced ? "Motion reduced" : playing ? "Show poster" : "Play media"}
        </button>
      )}
    </div>
  );
}

export function DeviceShowcase({ mediaIds, media, preset }: { mediaIds: string[]; media: MediaItem[]; preset: string }) {
  const items = mediaIds.map((id) => media.find((item) => item.id === id)).filter(Boolean) as MediaItem[];
  const phone = preset !== "browser";
  return <div className={`block-device block-device-${preset}`}>{items.map((item) => phone ? <Phone key={item.id} item={item} size="source-led" frameStyle="graphite-titanium" /> : <BrowserFrame key={item.id} item={item} />)}</div>;
}

export function PlayableMedia({ item }: { item: MediaItem }) {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  return <div className="playable-media"><BrowserFrame item={item} active={playing && !reduced} /><button className="media-toggle" type="button" disabled={reduced} onClick={() => setPlaying((value) => !value)} aria-pressed={playing}>{reduced ? "Motion reduced" : playing ? "Show poster" : "Play archive"}</button></div>;
}
