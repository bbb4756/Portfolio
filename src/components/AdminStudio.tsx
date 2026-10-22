/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element -- CMS previews preserve uploaded GIF and image files verbatim. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Collection = "projects" | "media" | "experience" | "engineering" | "settings";
type RecordItem = Record<string, any>;

const collections: Array<{ id: Collection; label: string }> = [
  { id: "projects", label: "Projects" },
  { id: "media", label: "Media Library" },
  { id: "engineering", label: "Engineering Cases" },
  { id: "experience", label: "Experience" },
  { id: "settings", label: "Site Settings" },
];

const projectTemplate = (): RecordItem => ({
  id: crypto.randomUUID(), slug: "", name: "Untitled project", subtitle: "", oneLiner: "", shortIntroduction: "", detailedIntroduction: "", projectType: "personal", platform: "web", period: "", organization: "", teamSize: "", role: "", contribution: "", techStack: [], githubUrl: "", serviceUrl: "", externalLinks: [], status: "draft", featured: false, showOnHome: false, order: Date.now(), emphasis: "standard", listDescription: "", seoTitle: "", seoDescription: "", presentation: { platform: "desktop-web", layout: "browser-frame", featuredMediaId: "", mediaIds: [], frameStyle: "minimal-dark", deviceSize: "regular", alignment: "center", background: "charcoal", imageFit: "contain", desktopPreset: "wide", mobilePreset: "single" }, blocks: [], engineeringCaseIds: [], relatedProjectIds: [], updatedAt: new Date().toISOString(),
});

const experienceTemplate = (): RecordItem => ({ id: crypto.randomUUID(), company: "", period: "", role: "", services: [], technologies: [], responsibilities: [], achievements: [], projectIds: [], order: Date.now() });
const engineeringTemplate = (): RecordItem => ({ id: crypto.randomUUID(), slug: "", title: "Untitled case", projectIds: [], background: "", constraints: "", rootCause: "", alternatives: [], solution: "", implementation: "", verification: "", result: "", learnings: "", mediaIds: [], code: "", diagram: "", status: "draft", order: Date.now() });

const blockPresetGroups = [
  ["prose", "lead", "quote"], ["contained", "wide", "full-bleed"], ["contained", "wide", "cinematic"],
  ["grid", "rail", "stack"], ["single-phone", "multiple-phones", "browser", "editorial-split"],
  ["split", "sequence"], ["decision-record", "comparison"], ["image", "mermaid"], ["dark", "light"],
  ["grid", "inline"], ["vertical", "horizontal"], ["side-by-side", "stack"], ["note", "result", "warning"], ["list", "media"],
];

const blockTemplates: Record<string, () => RecordItem> = {
  text: () => ({ id: crypto.randomUUID(), type: "text", preset: "prose", title: "", body: "", emphasis: "" }),
  image: () => ({ id: crypto.randomUUID(), type: "image", preset: "contained", mediaId: "", caption: "" }),
  video: () => ({ id: crypto.randomUUID(), type: "video", preset: "contained", mediaId: "", caption: "" }),
  gallery: () => ({ id: crypto.randomUUID(), type: "gallery", preset: "grid", mediaIds: [] }),
  "device-showcase": () => ({ id: crypto.randomUUID(), type: "device-showcase", preset: "single-phone", mediaIds: [], title: "", body: "" }),
  "problem-solution": () => ({ id: crypto.randomUUID(), type: "problem-solution", preset: "split", problem: "", solution: "" }),
  "technical-decision": () => ({ id: crypto.randomUUID(), type: "technical-decision", preset: "decision-record", title: "", context: "", options: [], decision: "", rationale: "" }),
  architecture: () => ({ id: crypto.randomUUID(), type: "architecture", preset: "image", mediaId: "", mermaid: "", caption: "" }),
  code: () => ({ id: crypto.randomUUID(), type: "code", preset: "dark", language: "typescript", code: "", caption: "" }),
  metrics: () => ({ id: crypto.randomUUID(), type: "metrics", preset: "grid", items: [] }),
  timeline: () => ({ id: crypto.randomUUID(), type: "timeline", preset: "vertical", items: [] }),
  "before-after": () => ({ id: crypto.randomUUID(), type: "before-after", preset: "side-by-side", beforeMediaId: "", afterMediaId: "", description: "" }),
  callout: () => ({ id: crypto.randomUUID(), type: "callout", preset: "note", title: "", body: "" }),
  "related-projects": () => ({ id: crypto.randomUUID(), type: "related-projects", preset: "list", projectIds: [] }),
};

function splitList(value: string) { return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean); }
function contentVersionHeaders(version?: number): Record<string, string> { return version ? { "If-Match": String(version), "X-Content-Version": String(version) } : {}; }

function Field({ label, value, onChange, type = "text", required = false, readOnly = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; required?: boolean; readOnly?: boolean }) {
  const immutable = readOnly || label === "Project ID" || label === "id";
  if (label === "Preset") {
    const options = blockPresetGroups.find((group) => group.includes(String(value))) ?? [String(value)];
    return <label className="admin-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
  }
  if (label === "status") return <label className="admin-field"><span>Status</span><select value={value} onChange={(event) => onChange(event.target.value)}>{["draft", "published", "archived"].map((option) => <option key={option}>{option}</option>)}</select></label>;
  return <label className="admin-field"><span>{label}{immutable && <small> · immutable</small>}{required && <b> *</b>}</span><input type={type} value={value} required={required} readOnly={immutable} aria-readonly={immutable} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="admin-field admin-field-wide"><span>{label}</span><textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="admin-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="admin-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function MediaPicker({ label, value, multiple = false, media, onChange }: { label: string; value: string | string[]; multiple?: boolean; media: RecordItem[]; onChange: (value: string | string[]) => void }) {
  if (!multiple) return <Select label={label} value={String(value)} options={["", ...media.map((item) => item.id)]} onChange={onChange as (value: string) => void} />;
  const ordered = Array.isArray(value) ? value : [];
  const selected = new Set(ordered);
  const move = (index: number, direction: -1 | 1) => {
    const next = [...ordered];
    const [item] = next.splice(index, 1);
    next.splice(index + direction, 0, item);
    onChange(next);
  };
  return <fieldset className="admin-field admin-field-wide media-picker"><legend>{label}</legend>{ordered.length > 0 && <ol className="media-order-list">{ordered.map((id, index) => <li key={id}><span>{media.find((item) => item.id === id)?.title ?? id}</span><span><button type="button" aria-label={`Move ${id} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`Move ${id} down`} disabled={index === ordered.length - 1} onClick={() => move(index, 1)}>↓</button></span></li>)}</ol>}{media.map((item) => <Toggle key={item.id} label={item.title} checked={selected.has(item.id)} onChange={(checked) => { const next = checked ? [...ordered, item.id] : ordered.filter((id) => id !== item.id); onChange(next); }} />)}</fieldset>;
}

function BlockEditor({ block, index, total, media, onChange, onMove, onDelete }: { block: RecordItem; index: number; total: number; media: RecordItem[]; onChange: (value: RecordItem) => void; onMove: (direction: -1 | 1) => void; onDelete: () => void }) {
  const set = (key: string, value: unknown) => onChange({ ...block, [key]: value });
  const excluded = new Set(["id", "type", "preset", "mediaId", "mediaIds", "beforeMediaId", "afterMediaId"]);
  return <article className="block-editor"><header><div><span>{String(index + 1).padStart(2, "0")}</span><strong>{block.type}</strong></div><div><button type="button" disabled={index === 0} onClick={() => onMove(-1)}>↑</button><button type="button" disabled={index === total - 1} onClick={() => onMove(1)}>↓</button><button type="button" className="danger-text" onClick={onDelete}>Delete</button></div></header><div className="admin-grid"><Field label="Preset" value={block.preset ?? ""} onChange={(value) => set("preset", value)} />{"mediaId" in block && <MediaPicker label="Media" value={block.mediaId} media={media} onChange={(value) => set("mediaId", value)} />}{"mediaIds" in block && <MediaPicker label="Media items" value={block.mediaIds} multiple media={media} onChange={(value) => set("mediaIds", value)} />}{"beforeMediaId" in block && <MediaPicker label="Before media" value={block.beforeMediaId} media={media} onChange={(value) => set("beforeMediaId", value)} />}{"afterMediaId" in block && <MediaPicker label="After media" value={block.afterMediaId} media={media} onChange={(value) => set("afterMediaId", value)} />}{Object.entries(block).filter(([key]) => !excluded.has(key)).map(([key, value]) => Array.isArray(value) ? <TextArea key={key} label={`${key} · one item per line or JSON`} value={value.some((item) => typeof item === "object") ? JSON.stringify(value, null, 2) : value.join("\n")} onChange={(next) => { try { set(key, next.trim().startsWith("[") ? JSON.parse(next) : splitList(next)); } catch { set(key, value); } }} /> : typeof value === "string" && value.length > 80 ? <TextArea key={key} label={key} value={value} onChange={(next) => set(key, next)} /> : <Field key={key} label={key} value={String(value ?? "")} onChange={(next) => set(key, next)} />)}</div></article>;
}

function ProjectEditor({ value, media, onChange }: { value: RecordItem; media: RecordItem[]; onChange: (value: RecordItem) => void }) {
  const set = (key: string, next: unknown) => onChange({ ...value, [key]: next, updatedAt: new Date().toISOString() });
  const presentation = value.presentation ?? {};
  const setPresentation = (key: string, next: unknown) => set("presentation", { ...presentation, [key]: next });
  const blocks: RecordItem[] = value.blocks ?? [];
  return <>
    <section className="admin-section"><h2>Basic information</h2><div className="admin-grid"><Field label="Project ID" value={value.id} onChange={(next) => set("id", next)} required /><Field label="Slug" value={value.slug} onChange={(next) => set("slug", next)} required /><Field label="Project name" value={value.name} onChange={(next) => set("name", next)} required /><Field label="Subtitle" value={value.subtitle} onChange={(next) => set("subtitle", next)} /><TextArea label="One-line summary" value={value.oneLiner} onChange={(next) => set("oneLiner", next)} /><TextArea label="Short introduction" value={value.shortIntroduction} onChange={(next) => set("shortIntroduction", next)} /><TextArea label="Detailed introduction" value={value.detailedIntroduction} rows={7} onChange={(next) => set("detailedIntroduction", next)} /><Select label="Project type" value={value.projectType} options={["company", "personal", "side-project"]} onChange={(next) => set("projectType", next)} /><Select label="Platform" value={value.platform} options={["web", "mobile-web", "native-app", "hybrid-app"]} onChange={(next) => set("platform", next)} /><Field label="Period" value={value.period} onChange={(next) => set("period", next)} /><Field label="Company / organization" value={value.organization} onChange={(next) => set("organization", next)} /><Field label="Team size" value={value.teamSize} onChange={(next) => set("teamSize", next)} /><Field label="Role" value={value.role} onChange={(next) => set("role", next)} /><TextArea label="Contribution" value={value.contribution} onChange={(next) => set("contribution", next)} /><TextArea label="Tech stack · one per line" value={(value.techStack ?? []).join("\n")} onChange={(next) => set("techStack", splitList(next))} /><Field label="GitHub URL" value={value.githubUrl} type="url" onChange={(next) => set("githubUrl", next)} /><Field label="Service URL" value={value.serviceUrl} type="url" onChange={(next) => set("serviceUrl", next)} /></div></section>
    <section className="admin-section"><h2>Links &amp; relationships</h2><div className="admin-grid"><TextArea label="External links · JSON [{ label, url }]" value={JSON.stringify(value.externalLinks ?? [], null, 2)} onChange={(next) => { try { set("externalLinks", JSON.parse(next)); } catch { /* retain last valid JSON */ } }} /><TextArea label="Engineering case IDs · one per line" value={(value.engineeringCaseIds ?? []).join("\n")} onChange={(next) => set("engineeringCaseIds", splitList(next))} /><TextArea label="Related project IDs · one per line" value={(value.relatedProjectIds ?? []).join("\n")} onChange={(next) => set("relatedProjectIds", splitList(next))} /></div></section>
    <section className="admin-section"><h2>Publication</h2><div className="admin-grid"><Select label="Status" value={value.status} options={["draft", "published", "archived"]} onChange={(next) => set("status", next)} /><Field label="Order" value={value.order} type="number" onChange={(next) => set("order", Number(next))} /><Select label="Emphasis" value={value.emphasis} options={["standard", "large", "hero"]} onChange={(next) => set("emphasis", next)} /><Toggle label="Featured project" checked={value.featured} onChange={(next) => set("featured", next)} /><Toggle label="Show on home" checked={value.showOnHome} onChange={(next) => set("showOnHome", next)} /><TextArea label="List description" value={value.listDescription} onChange={(next) => set("listDescription", next)} /><Field label="SEO title" value={value.seoTitle} onChange={(next) => set("seoTitle", next)} /><TextArea label="SEO description" value={value.seoDescription} onChange={(next) => set("seoDescription", next)} /></div></section>
    <section className="admin-section"><h2>Media presentation</h2><p className="admin-section-help">디자인 시스템에 정의된 프리셋만 선택할 수 있습니다.</p><div className="admin-grid"><Select label="Presentation platform" value={presentation.platform} options={["desktop-web", "mobile-web", "native-app", "hybrid-app"]} onChange={(next) => setPresentation("platform", next)} /><Select label="Layout" value={presentation.layout} options={["single-phone", "multiple-phones", "browser-frame", "full-bleed", "editorial-split", "gallery"]} onChange={(next) => setPresentation("layout", next)} /><MediaPicker label="Featured media" value={presentation.featuredMediaId} media={media} onChange={(next) => setPresentation("featuredMediaId", next)} /><MediaPicker label="Media order" value={presentation.mediaIds} multiple media={media} onChange={(next) => setPresentation("mediaIds", next)} /><Select label="Frame style" value={presentation.frameStyle} options={["graphite-titanium", "minimal-dark", "none"]} onChange={(next) => setPresentation("frameStyle", next)} /><Select label="Device size" value={presentation.deviceSize} options={["compact", "regular", "large", "source-led"]} onChange={(next) => setPresentation("deviceSize", next)} /><Select label="Alignment" value={presentation.alignment} options={["start", "center", "end", "asymmetric"]} onChange={(next) => setPresentation("alignment", next)} /><Select label="Background" value={presentation.background} options={["charcoal", "black", "ivory", "project-accent"]} onChange={(next) => setPresentation("background", next)} /><Select label="Image fit" value={presentation.imageFit} options={["contain", "cover"]} onChange={(next) => setPresentation("imageFit", next)} /><Select label="Desktop layout" value={presentation.desktopPreset} options={["single", "staggered", "editorial", "wide"]} onChange={(next) => setPresentation("desktopPreset", next)} /><Select label="Mobile layout" value={presentation.mobilePreset} options={["single", "two-up", "stack", "swipe"]} onChange={(next) => setPresentation("mobilePreset", next)} /></div></section>
    <section className="admin-section"><div className="section-action"><div><h2>Case study blocks</h2><p className="admin-section-help">블록은 프로젝트별로 자유롭게 추가하고 순서를 바꿀 수 있습니다.</p></div><select aria-label="Add block" defaultValue="" onChange={(event) => { if (!event.target.value) return; set("blocks", [...blocks, blockTemplates[event.target.value]()]); event.target.value = ""; }}><option value="">Add block…</option>{Object.keys(blockTemplates).map((type) => <option key={type} value={type}>{type}</option>)}</select></div>{blocks.length === 0 && <p className="admin-empty">No case-study blocks yet.</p>}{blocks.map((block, index) => <BlockEditor key={block.id} block={block} index={index} total={blocks.length} media={media} onChange={(next) => set("blocks", blocks.map((item, itemIndex) => itemIndex === index ? next : item))} onMove={(direction) => { const next = [...blocks]; const [item] = next.splice(index, 1); next.splice(index + direction, 0, item); set("blocks", next); }} onDelete={() => set("blocks", blocks.filter((_, itemIndex) => itemIndex !== index))} />)}</section>
  </>;
}

function GenericEditor({ value, onChange }: { value: RecordItem; onChange: (value: RecordItem) => void }) {
  const set = (key: string, next: unknown) => onChange({ ...value, [key]: next });
  return <section className="admin-section"><h2>Content fields</h2><div className="admin-grid">{Object.entries(value).map(([key, fieldValue]) => {
    if (typeof fieldValue === "boolean") return <Toggle key={key} label={key} checked={fieldValue} onChange={(next) => set(key, next)} />;
    if (typeof fieldValue === "number") return <Field key={key} label={key} value={fieldValue} type="number" onChange={(next) => set(key, Number(next))} />;
    if (Array.isArray(fieldValue)) return <TextArea key={key} label={`${key} · one per line`} value={fieldValue.some((item) => typeof item === "object") ? JSON.stringify(fieldValue, null, 2) : fieldValue.join("\n")} onChange={(next) => { try { set(key, next.trim().startsWith("[") ? JSON.parse(next) : splitList(next)); } catch { /* retain last valid value */ } }} />;
    return String(fieldValue).length > 80 ? <TextArea key={key} label={key} value={String(fieldValue)} onChange={(next) => set(key, next)} /> : <Field key={key} label={key} value={String(fieldValue ?? "")} onChange={(next) => set(key, next)} />;
  })}</div></section>;
}

async function appendDimensions(data: FormData, file: File) {
  if (file.type.startsWith("image/")) {
    const bitmap = await createImageBitmap(file); data.set("width", String(bitmap.width)); data.set("height", String(bitmap.height)); bitmap.close();
    return;
  }
  if (!file.type.startsWith("video/")) return;
  const source = URL.createObjectURL(file);
  const video = document.createElement("video");
  try {
    video.preload = "metadata";
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read video dimensions"));
      video.src = source;
    });
    data.set("width", String(video.videoWidth));
    data.set("height", String(video.videoHeight));
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(source);
  }
}

async function uploadDirect(file: File, data: FormData, replaceId?: string, expectedVersion?: number) {
  const startResponse = await fetch("/api/admin/media-direct/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      size: file.size,
      title: String(data.get("title") || file.name),
      alt: String(data.get("alt") || ""),
      width: Number(data.get("width") || 0),
      height: Number(data.get("height") || 0),
      replaceId,
      expectedVersion,
    }),
  });
  const start = await startResponse.json();
  if (!startResponse.ok) throw new Error(start.error ?? "Could not start direct upload");
  try {
    const uploadResponse = await fetch(start.uploadUrl, { method: "PUT", headers: start.headers, body: file });
    if (!uploadResponse.ok) throw new Error(`Object storage upload failed (${uploadResponse.status})`);
    const completeResponse = await fetch("/api/admin/media-direct/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadToken: start.uploadToken }),
    });
    const complete = await completeResponse.json();
    if (!completeResponse.ok) throw new Error(complete.error ?? "Could not complete direct upload");
    return complete.item;
  } catch (error) {
    await fetch("/api/admin/media-direct/cancel", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadToken: start.uploadToken }),
    }).catch(() => undefined);
    throw error;
  }
}

function MediaCard({ item, version, refresh, setMessage }: { item: RecordItem; version?: number; refresh: () => Promise<void>; setMessage: (value: string) => void }) {
  const [draft, setDraft] = useState(item);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const response = await fetch(`/api/admin/content/media/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json", ...contentVersionHeaders(version) }, body: JSON.stringify(draft) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(`Error · ${body.error ?? "Metadata save failed"}`);
    setMessage("Media metadata saved."); await refresh();
  };
  const replace = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return; setBusy(true);
    try {
      const data = new FormData(); data.set("file", file); data.set("title", draft.title); data.set("alt", draft.alt); await appendDimensions(data, file);
      await uploadDirect(file, data, item.id, version);
      setMessage("Media replaced. The previous file remains in history."); await refresh();
    } catch (error) { setMessage(`Error · ${error instanceof Error ? error.message : "Replacement failed"}`); }
    finally { setBusy(false); event.target.value = ""; }
  };
  const remove = async () => {
    if (!confirm("Delete this media metadata? Referenced media is protected.")) return;
    const response = await fetch(`/api/admin/content/media/${item.id}`, { method: "DELETE", headers: contentVersionHeaders(version) }); const body = await response.json();
    if (!response.ok) return setMessage(`Error · ${body.error ?? "Delete failed"}`); setMessage("Media metadata deleted."); await refresh();
  };
  return <article><div>{item.kind === "video" ? <video src={item.file} poster={item.poster || undefined} /> : <img src={item.poster || item.file} alt={item.alt} />}</div><h3>{item.title}</h3><p>{item.originalWidth}×{item.originalHeight} · {(item.fileSize / 1024 / 1024).toFixed(2)} MB</p><p>{item.kind} · {item.id}</p><details><summary>Edit metadata</summary><div className="media-card-fields"><Field label="Title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} /><TextArea label="Description" value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} /><TextArea label="Alt text" value={draft.alt} onChange={(value) => setDraft({ ...draft, alt: value })} /><Field label="Poster path" value={draft.poster} onChange={(value) => setDraft({ ...draft, poster: value })} /><Field label="Order" type="number" value={draft.order} onChange={(value) => setDraft({ ...draft, order: Number(value) })} /><Toggle label="Featured" checked={draft.featured} onChange={(value) => setDraft({ ...draft, featured: value })} /><Toggle label="Autoplay" checked={draft.autoplay} onChange={(value) => setDraft({ ...draft, autoplay: value })} /><Toggle label="Loop" checked={draft.loop} onChange={(value) => setDraft({ ...draft, loop: value })} /><Toggle label="Muted" checked={draft.muted} onChange={(value) => setDraft({ ...draft, muted: value })} /><Toggle label="Show on mobile" checked={draft.showOnMobile} onChange={(value) => setDraft({ ...draft, showOnMobile: value })} /><Toggle label="Show on desktop" checked={draft.showOnDesktop} onChange={(value) => setDraft({ ...draft, showOnDesktop: value })} /><button type="button" className="admin-primary" disabled={busy} onClick={save}>Save metadata</button><label className="admin-field"><span>Replace original</span><input type="file" disabled={busy} onChange={replace} accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" /></label></div></details><button className="danger-text" type="button" onClick={remove}>Delete</button></article>;
}

function MediaLibrary({ items, versions, refresh, setMessage }: { items: RecordItem[]; versions: Record<string, number>; refresh: () => Promise<void>; setMessage: (value: string) => void }) {
  const [busy, setBusy] = useState(false);
  const upload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget; const data = new FormData(form); const file = data.get("file");
    if (!(file instanceof File)) { setBusy(false); return; }
    try {
      await appendDimensions(data, file);
      await uploadDirect(file, data);
      form.reset(); setMessage("Media uploaded to object storage and metadata saved."); await refresh();
    } catch (error) { setMessage(`Error · ${error instanceof Error ? error.message : "Upload failed"}`); }
    finally { setBusy(false); }
  };
  return <><section className="admin-section"><h2>Upload media</h2><p className="admin-section-help">PNG, JPEG, WebP, GIF, MP4, WebM · all binaries upload directly to configured object storage (default maximum 250 MB). Alt text is required.</p><form className="upload-form" onSubmit={upload}><label className="admin-field"><span>Title</span><input name="title" /></label><label className="admin-field"><span>File *</span><input name="file" type="file" required accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" /></label><label className="admin-field admin-field-wide"><span>Alt text *</span><input name="alt" required /></label><button className="admin-primary" disabled={busy}>{busy ? "Uploading…" : "Upload media"}</button></form></section><section className="media-library">{items.sort((a, b) => a.order - b.order).map((item) => <MediaCard key={item.id} item={item} version={versions[item.id]} refresh={refresh} setMessage={setMessage} />)}</section></>;
}

export function AdminStudio({ login, preview }: { login: string; preview: boolean }) {
  const [collection, setCollection] = useState<Collection>("projects");
  const [items, setItems] = useState<RecordItem[]>([]);
  const [media, setMedia] = useState<RecordItem[]>([]);
  const [versions, setVersions] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<RecordItem | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = draft ? JSON.stringify(draft) !== savedSnapshot : false;

  const load = useCallback(async (target: Collection = collection) => {
    const response = await fetch(`/api/admin/content/${target}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Load failed");
    setItems(body.items); setVersions(body.versions ?? {});
    if (target !== "media") {
      const mediaResponse = await fetch("/api/admin/content/media", { cache: "no-store" });
      const mediaBody = await mediaResponse.json(); if (mediaResponse.ok) setMedia(mediaBody.items);
    } else setMedia(body.items);
    const first = target === "settings" ? body.items[0] : body.items.find((item: RecordItem) => item.id === selectedId) ?? body.items[0];
    setSelectedId(first?.id ?? ""); setDraft(first ? structuredClone(first) : null); setSavedSnapshot(first ? JSON.stringify(first) : "");
  }, [collection, selectedId]);

  // Loading a collection intentionally replaces the selected record and draft state.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(collection).catch((error) => setMessage(`Error · ${error.message}`)); }, [collection]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  useEffect(() => {
    const region = document.querySelector<HTMLElement>(".admin-message");
    if (!region) return;
    region.dataset.tone = /error|failed|invalid|unknown|required|unsupported|exceeds|unauthor|could not/i.test(message) ? "error" : "success";
  }, [message]);

  const selectItem = (item: RecordItem) => { if (dirty && !confirm("Discard unsaved changes?")) return; setSelectedId(item.id ?? "site"); setDraft(structuredClone(item)); setSavedSnapshot(JSON.stringify(item)); setMessage(""); };
  const create = () => { if (dirty && !confirm("Discard unsaved changes?")) return; const value = collection === "projects" ? projectTemplate() : collection === "experience" ? experienceTemplate() : engineeringTemplate(); setSelectedId(value.id); setDraft(value); setSavedSnapshot(""); };
  const duplicate = () => { if (!draft || collection !== "projects") return; const copy = { ...structuredClone(draft), id: crypto.randomUUID(), slug: `${draft.slug}-copy`, name: `${draft.name} Copy`, status: "draft", showOnHome: false, featured: false, updatedAt: new Date().toISOString() }; setSelectedId(copy.id); setDraft(copy); setSavedSnapshot(""); };
  const save = async () => {
    if (!draft) return; setBusy(true); setMessage("");
    const id = collection === "settings" ? "site" : selectedId || draft.id;
    const version = versions[id];
    const response = await fetch(`/api/admin/content/${collection}/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", ...contentVersionHeaders(version) }, body: JSON.stringify(draft) }); const body = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(`Error · ${body.error ?? "Save failed. Your draft is still in this browser tab."}`);
    setDraft(body.item); setSavedSnapshot(JSON.stringify(body.item)); setMessage(preview ? "Saved to the local QA content tree." : "Saved to PostgreSQL. Public pages read the new value on the next request."); await load(collection); setVersions((current) => ({ ...current, [id]: body.version }));
  };
  const remove = async () => { if (!draft || collection === "settings" || !confirm(`Delete ${draft.name ?? draft.title ?? draft.company ?? draft.id}?`)) return; const version = versions[draft.id]; const response = await fetch(`/api/admin/content/${collection}/${draft.id}`, { method: "DELETE", headers: contentVersionHeaders(version) }); const body = await response.json(); if (!response.ok) return setMessage(`Error · ${body.error ?? "Delete failed"}`); setMessage("Deleted."); await load(collection); };
  const filtered = useMemo(() => items.filter((item) => JSON.stringify(item).toLowerCase().includes(search.toLowerCase())), [items, search]);

  return <div className="admin-shell"><aside className="admin-nav"><div><p className="admin-kicker">Portfolio Studio</p><strong>{login}</strong>{preview && <span className="preview-badge">Local QA</span>}</div><nav>{collections.map((item) => <button key={item.id} className={collection === item.id ? "active" : ""} onClick={() => { if (!dirty || confirm("Discard unsaved changes?")) { setCollection(item.id); setSearch(""); setMessage(""); } }}>{item.label}</button>)}</nav><div><a href="/" target="_blank">Open portfolio ↗</a>{!preview && <form action="/api/auth/logout" method="post"><button>Sign out</button></form>}</div></aside><main className="admin-main"><header className="admin-toolbar"><div><p className="admin-kicker">{collections.find((item) => item.id === collection)?.label}</p><h1>{collection === "media" ? "Media Library" : draft?.name ?? draft?.title ?? draft?.company ?? "Content"}</h1></div><div className="toolbar-actions">{collection === "projects" && draft && <><a href={`/projects/${draft.slug}`} target="_blank">Preview ↗</a><button type="button" onClick={duplicate}>Duplicate</button></>}{!(["settings", "media"] as Collection[]).includes(collection) && <button type="button" onClick={create}>New</button>}{draft && collection !== "media" && <button type="button" className="admin-primary" disabled={busy || !dirty} onClick={save}>{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>}</div></header>{message && <div className="admin-message" role="status">{message}</div>}{collection === "media" ? <MediaLibrary items={items} versions={versions} refresh={() => load("media")} setMessage={setMessage} /> : <div className="admin-workspace">{collection !== "settings" && <aside className="content-list"><label><span>Search</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search content" /></label>{filtered.map((item) => <button key={item.id} className={selectedId === item.id ? "active" : ""} onClick={() => selectItem(item)}><strong>{item.name ?? item.title ?? item.company ?? item.id}</strong><span>{item.status ?? item.period ?? ""}</span></button>)}</aside>}<form className="admin-editor" onSubmit={(event) => { event.preventDefault(); save(); }}>{draft && (collection === "projects" ? <ProjectEditor value={draft} media={media} onChange={setDraft} /> : <GenericEditor value={draft} onChange={setDraft} />)}{draft && collection !== "settings" && <div className="danger-zone"><h2>Danger zone</h2><p>삭제는 즉시 데이터베이스에 반영됩니다. 사용 중인 미디어는 삭제되지 않습니다.</p><button type="button" onClick={remove}>Delete content</button></div>}</form></div>}</main></div>;
}
