"use client";

import type { DocumentDetail } from "@uintell/shared/contracts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { normalizeReaderAnchor, slugifyText } from "@/lib/reader-links";

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const MARKDOWN_HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/gm;
const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);
const CODE_EXTENSIONS = new Set([
  ".c",
  ".cpp",
  ".go",
  ".h",
  ".hpp",
  ".java",
  ".js",
  ".json",
  ".py",
  ".rs",
  ".sh",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

export type ReaderSection = {
  title: string | null;
  anchor: string | null;
  content: string;
  format: "markdown" | "text" | "code";
};

export function buildReaderSections(document: DocumentDetail): ReaderSection[] {
  const extension = getDocumentExtension(document);
  const rawContent = document.raw_content?.trim() ?? "";

  if (extension && CODE_EXTENSIONS.has(extension) && rawContent) {
    return [
      {
        title: document.title,
        anchor: normalizeReaderAnchor(document.title, null),
        content: rawContent,
        format: "code",
      },
    ];
  }

  if (extension && MARKDOWN_EXTENSIONS.has(extension) && rawContent) {
    const markdownSections = parseMarkdownSections(rawContent, document.title);
    if (markdownSections.length > 0) {
      return markdownSections;
    }
  }

  if ((document.sections ?? []).length > 0) {
    return document.sections
      .filter((section) => section.content.trim())
      .map((section, index) => ({
        title: section.title ?? (index === 0 ? document.title : `Section ${index + 1}`),
        anchor: normalizeReaderAnchor(section.title ?? document.title, section.anchor),
        content: section.content,
        format: "text",
      }));
  }

  if (document.plain_text?.trim()) {
    return [
      {
        title: document.title,
        anchor: normalizeReaderAnchor(document.title, null),
        content: document.plain_text.trim(),
        format: "text",
      },
    ];
  }

  return [];
}

export function DocumentBody({
  document,
  sections,
}: {
  document: DocumentDetail;
  sections: ReaderSection[];
}) {
  return (
    <div className="space-y-10">
      {sections.map((section, index) => {
        const isTitleSection = index === 0 && section.title && slugifyText(section.title) === slugifyText(document.title);
        const label = isTitleSection ? "Overview" : section.title ?? `Section ${index + 1}`;

        return (
          <section
            key={`${section.anchor ?? label}-${index}`}
            id={section.anchor ?? undefined}
            className="scroll-mt-24 border-b border-[#12311d] pb-10 last:border-b-0 last:pb-0"
          >
            <div className="flex items-center gap-3">
              {!isTitleSection ? <h2 className="text-2xl font-semibold text-[#7df2a6]">{label}</h2> : null}
              {section.anchor ? (
                <a href={`#${section.anchor}`} className="text-xs uppercase tracking-[0.16em] text-[#4d8dff] hover:text-[#7aaaff]">
                  Link
                </a>
              ) : null}
            </div>

            <div className="mt-4">
              {section.format === "markdown" ? <MarkdownBlock content={section.content} /> : null}
              {section.format === "code" ? <CodeBlock content={section.content} /> : null}
              {section.format === "text" ? <PlainTextBlock content={section.content} /> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MarkdownBlock({ content }: { content: string }) {
  return (
    <div className="reader-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }: any) => (
            <a href={href} className="text-[#4d8dff] underline decoration-[#12311d] underline-offset-4 hover:text-[#7aaaff]">
              {children}
            </a>
          ),
          code: ({ inline, className, children, ...props }: any) => {
            if (!inline) {
              return (
                <code className="reader-code" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="reader-inline-code" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }: any) => <pre className="reader-code-shell">{children}</pre>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ content }: { content: string }) {
  return (
    <pre className="reader-code-shell">
      <code className="reader-code">{content}</code>
    </pre>
  );
}

function PlainTextBlock({ content }: { content: string }) {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="reader-prose">
      {blocks.map((block, index) => (
        <p key={`${index}-${block.slice(0, 24)}`}>{block}</p>
      ))}
    </div>
  );
}

function parseMarkdownSections(rawContent: string, documentTitle: string): ReaderSection[] {
  const body = rawContent.replace(FRONTMATTER_RE, "").trim();
  const matches = [...body.matchAll(MARKDOWN_HEADING_RE)];

  if (matches.length === 0) {
    return body
      ? [
          {
            title: documentTitle,
            anchor: normalizeReaderAnchor(documentTitle, null),
            content: body,
            format: "markdown",
          },
        ]
      : [];
  }

  const sections: ReaderSection[] = [];
  const preamble = body.slice(0, matches[0]?.index ?? 0).trim();
  if (preamble) {
    sections.push({
      title: "Overview",
      anchor: "overview",
      content: preamble,
      format: "markdown",
    });
  }

  for (const [index, match] of matches.entries()) {
    const title = match[2]?.trim() || `Section ${index + 1}`;
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1]?.index ?? body.length) : body.length;
    const content = body.slice(start, end).trim();
    sections.push({
      title,
      anchor: normalizeReaderAnchor(title, null),
      content: content || "",
      format: "markdown",
    });
  }

  return sections.filter((section) => section.content.trim() || section.title);
}

function getDocumentExtension(document: DocumentDetail): string | null {
  const extension = document.metadata?.extension;
  return typeof extension === "string" ? extension.toLowerCase() : null;
}
