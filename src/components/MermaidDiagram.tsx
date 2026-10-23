"use client";

import { useEffect, useId, useRef, useState } from "react";

type MermaidApi = {
  initialize: (options: Record<string, unknown>) => void;
  render: (id: string, source: string) => Promise<{ svg: string }>;
};

export function MermaidDiagram({ source, interactive = false }: { source: string; interactive?: boolean }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const [selection, setSelection] = useState("");
  const diagramRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    let active = true;
    const render = async () => {
      const mermaid = (window as Window & { mermaid?: MermaidApi }).mermaid;
      if (!mermaid) {
        window.setTimeout(render, 100);
        return;
      }
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "dark" });
      try {
        const result = await mermaid.render(`diagram-${id}`, source);
        if (active) setSvg(result.svg);
      } catch {
        if (active) setSvg("");
      }
    };
    render();
    return () => { active = false; };
  }, [id, source]);
  useEffect(() => {
    const diagram = diagramRef.current;
    const svgElement = diagram?.querySelector("svg");
    if (!interactive || !diagram || !svgElement) return;

    const nodes = Array.from(svgElement.querySelectorAll<SVGGElement>("g.node"));
    const edges = Array.from(svgElement.querySelectorAll<SVGElement>(".flowchart-link"));
    const labels = Array.from(svgElement.querySelectorAll<SVGElement>(".edgeLabel .label[data-id]"));
    const cleanups: Array<() => void> = [];
    const clearSelection = () => {
      svgElement.classList.remove("has-selection");
      nodes.forEach((node) => {
        node.classList.remove("is-selected");
        node.setAttribute("aria-pressed", "false");
      });
      edges.forEach((edge) => edge.classList.remove("is-related-edge"));
      labels.forEach((label) => label.classList.remove("is-related-label"));
      setSelection("");
    };
    resetRef.current = clearSelection;

    nodes.forEach((node) => {
      const match = node.id.match(/flowchart-([^-]+)-/);
      if (!match) return;
      const key = match[1];
      const label = node.textContent?.trim().replace(/\s+/g, " ") || key;
      const select = () => {
        svgElement.classList.add("has-selection");
        nodes.forEach((candidate) => {
          const selected = candidate === node;
          candidate.classList.toggle("is-selected", selected);
          candidate.setAttribute("aria-pressed", String(selected));
        });
        edges.forEach((edge) => edge.classList.toggle("is-related-edge", edge.id.includes(`_${key}_`)));
        labels.forEach((edgeLabel) => edgeLabel.classList.toggle("is-related-label", edgeLabel.dataset.id?.includes(`_${key}_`) ?? false));
        setSelection(label);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select();
        }
        if (event.key === "Escape") clearSelection();
      };
      node.setAttribute("tabindex", "0");
      node.setAttribute("role", "button");
      node.setAttribute("aria-label", `${label} 연결 관계 보기`);
      node.setAttribute("aria-pressed", "false");
      node.addEventListener("click", select);
      node.addEventListener("keydown", onKeyDown);
      cleanups.push(() => {
        node.removeEventListener("click", select);
        node.removeEventListener("keydown", onKeyDown);
        node.removeAttribute("tabindex");
        node.removeAttribute("role");
        node.removeAttribute("aria-label");
        node.removeAttribute("aria-pressed");
      });
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      resetRef.current = () => undefined;
    };
  }, [interactive, svg]);
  if (!svg) return <pre className="diagram-fallback">{source}</pre>;
  if (!interactive) return <div className="diagram" aria-label="Architecture diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
  return (
    <div className="interactive-diagram-shell">
      <div ref={diagramRef} className="diagram is-interactive" aria-label="Interactive architecture diagram" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="diagram-pan-hint">Swipe or drag to explore <span aria-hidden="true">↔</span></p>
      <div className="diagram-explorer-copy">
        <p className="eyebrow">Interactive architecture</p>
        <p className="diagram-status" aria-live="polite">{selection || "노드를 선택해 연결 흐름을 확인하세요."}</p>
        <button type="button" onClick={() => resetRef.current()} disabled={!selection}>Reset view</button>
      </div>
    </div>
  );
}
