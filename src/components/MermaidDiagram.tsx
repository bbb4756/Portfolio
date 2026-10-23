"use client";

import { useEffect, useId, useState } from "react";

type MermaidApi = {
  initialize: (options: Record<string, unknown>) => void;
  render: (id: string, source: string) => Promise<{ svg: string }>;
};

export function MermaidDiagram({ source }: { source: string }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
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
  if (!svg) return <pre className="diagram-fallback">{source}</pre>;
  return <div className="diagram" aria-label="Architecture diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
}
