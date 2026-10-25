import type { ReactNode } from "react";

const inlinePattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
const listPattern = /^[-*]\s+/;
const orderedPattern = /^\d+\.\s+/;

function renderInline(value: string): ReactNode[] {
  return value.split(inlinePattern).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function parseTableRow(line: string) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

export function EngineeringProse({ children }: { children: string }) {
  const lines = children.trim().split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }

    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) tableLines.push(lines[index++]);
      const rows = tableLines.map(parseTableRow).filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)));
      const [head, ...body] = rows;
      if (head) blocks.push(
        <div className="engineering-table-wrap" key={`table-${index}`} tabIndex={0}>
          <table><thead><tr>{head.map((cell) => <th key={cell}>{renderInline(cell)}</th>)}</tr></thead><tbody>{body.map((row, rowIndex) => <tr key={`${row.join("-")}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{renderInline(cell)}</td>)}</tr>)}</tbody></table>
        </div>,
      );
      continue;
    }

    if (listPattern.test(line)) {
      const items: string[] = [];
      while (index < lines.length && listPattern.test(lines[index].trim())) items.push(lines[index++].trim().replace(listPattern, ""));
      blocks.push(<ul key={`list-${index}`}>{items.map((item) => <li key={item}>{renderInline(item)}</li>)}</ul>);
      continue;
    }

    if (orderedPattern.test(line)) {
      const items: string[] = [];
      while (index < lines.length && orderedPattern.test(lines[index].trim())) items.push(lines[index++].trim().replace(orderedPattern, ""));
      blocks.push(<ol key={`ordered-${index}`}>{items.map((item) => <li key={item}>{renderInline(item)}</li>)}</ol>);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || next.startsWith("|") || listPattern.test(next) || orderedPattern.test(next)) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{renderInline(paragraph.join(" "))}</p>);
  }

  return <div className="engineering-richtext">{blocks}</div>;
}
