/**
 * A deliberately small, dependency-free Markdown renderer for notes.
 * Supports: # headings, **bold**, *italic*, `code`, fenced code blocks,
 * - lists, 1. lists, - [ ] / - [x] checklists, > quotes, --- rules, and links.
 * All input is HTML-escaped FIRST, so the output is safe to inject.
 */
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(raw: string): string {
  let s = escapeHtml(raw);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return s;
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let list: "ul" | "ol" | null = null;
  let inCode = false;
  const closeList = () => { if (list) { html.push(`</${list}>`); list = null; } };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      closeList();
      html.push(inCode ? "</code></pre>" : "<pre><code>");
      inCode = !inCode;
      continue;
    }
    if (inCode) { html.push(escapeHtml(line) + "\n"); continue; }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const task = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);

    if (h) { closeList(); html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); }
    else if (task) {
      if (list !== "ul") { closeList(); html.push("<ul>"); list = "ul"; }
      const checked = task[1].toLowerCase() === "x";
      html.push(`<li class="task${checked ? " done" : ""}"><span aria-hidden="true">${checked ? "☑" : "☐"}</span> ${inline(task[2])}</li>`);
    } else if (ul) {
      if (list !== "ul") { closeList(); html.push("<ul>"); list = "ul"; }
      html.push(`<li>${inline(ul[1])}</li>`);
    } else if (ol) {
      if (list !== "ol") { closeList(); html.push("<ol>"); list = "ol"; }
      html.push(`<li>${inline(ol[1])}</li>`);
    } else if (/^>\s?/.test(line)) { closeList(); html.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`); }
    else if (/^---+$/.test(line.trim())) { closeList(); html.push("<hr/>"); }
    else if (line.trim() === "") { closeList(); }
    else { closeList(); html.push(`<p>${inline(line)}</p>`); }
  }
  closeList();
  if (inCode) html.push("</code></pre>");
  return html.join("\n");
}
