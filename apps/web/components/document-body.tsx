"use client";

import type { DocumentDetail } from "@uintell/shared/contracts";
import { Children, isValidElement, useState } from "react";
import type { ReactNode } from "react";
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
  level: number;
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
        level: 1,
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
        format: "text" as const,
        level: 2,
      }));
  }

  if (document.plain_text?.trim()) {
    return [
      {
        title: document.title,
        anchor: normalizeReaderAnchor(document.title, null),
        content: document.plain_text.trim(),
        format: "text",
        level: 1,
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
    <div className="space-y-12">
      {sections.map((section, index) => {
        const isTitleSection = index === 0 && section.title && slugifyText(section.title) === slugifyText(document.title);
        const label = isTitleSection ? "Overview" : section.title ?? `Section ${index + 1}`;

        return (
          <section
            key={`${section.anchor ?? label}-${index}`}
            id={section.anchor ?? undefined}
            className="scroll-mt-24 border-b border-[#12311d] pb-12 last:border-b-0 last:pb-0"
          >
            {!isTitleSection ? <SectionHeading section={section} label={label} /> : null}

            <div className={isTitleSection ? undefined : "mt-6"}>
              {section.format === "markdown" ? <MarkdownBlock content={section.content} /> : null}
              {section.format === "code" ? <CodeBlockFrame content={section.content} language="source" /> : null}
              {section.format === "text" ? <PlainTextBlock content={section.content} /> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SectionHeading({
  section,
  label,
}: {
  section: ReaderSection;
  label: string;
}) {
  const level = Math.min(Math.max(section.level + 1, 2), 4) as 2 | 3 | 4;
  const Tag = `h${level}` as const;
  const className =
    level === 2
      ? "text-3xl font-semibold tracking-tight text-[#7df2a6]"
      : level === 3
        ? "text-2xl font-semibold tracking-tight text-[#7df2a6]"
        : "text-xl font-semibold tracking-tight text-[#7df2a6]";

  return (
    <div className="flex items-center gap-3">
      <Tag className={className}>{label}</Tag>
      {section.anchor ? (
        <a href={`#${section.anchor}`} className="text-xs uppercase tracking-[0.16em] text-[#4d8dff] hover:text-[#7aaaff]">
          Link
        </a>
      ) : null}
    </div>
  );
}

function MarkdownBlock({ content }: { content: string }) {
  return (
    <div className="reader-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <MarkdownHeading level={1}>{children}</MarkdownHeading>,
          h2: ({ children }) => <MarkdownHeading level={2}>{children}</MarkdownHeading>,
          h3: ({ children }) => <MarkdownHeading level={3}>{children}</MarkdownHeading>,
          h4: ({ children }) => <MarkdownHeading level={4}>{children}</MarkdownHeading>,
          a: ({ children, href }: any) => (
            <a href={href} className="text-[#4d8dff] underline decoration-[#12311d] underline-offset-4 hover:text-[#7aaaff]">
              {children}
            </a>
          ),
          code: ({ inline, children, ...props }: any) => {
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
          pre: ({ children }: any) => (
            <CodeBlockFrame
              content={extractNodeText(children, { preserveWhitespace: true }).replace(/\n$/, "")}
              language={extractMarkdownLanguage(children)}
            >
              {children}
            </CodeBlockFrame>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlockFrame({
  content,
  language,
  children,
}: {
  content: string;
  language: string | null;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="reader-code-block">
      <div className="reader-code-bar">
        <span>{language ?? "code"}</span>
        <button type="button" onClick={() => void copyCode()} className="reader-code-copy">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="reader-code-shell">{children ?? <code className="reader-code">{content}</code>}</pre>
    </div>
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
            level: 1,
          },
        ]
      : [];
  }

  let overviewContent = body.slice(0, matches[0]?.index ?? 0).trim();
  const sections: ReaderSection[] = [];

  for (const [index, match] of matches.entries()) {
    const title = match[2]?.trim() || `Section ${index + 1}`;
    const rawLevel = Math.max(1, match[1]?.length ?? 1);
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1]?.index ?? body.length) : body.length;
    const content = body.slice(start, end).trim();

    // Lift a duplicate markdown H1 into the overview so the page title remains singular.
    if (index === 0 && slugifyText(title) === slugifyText(documentTitle)) {
      overviewContent = [overviewContent, content].filter(Boolean).join("\n\n").trim();
      continue;
    }

    sections.push({
      title,
      anchor: normalizeReaderAnchor(title, null),
      content,
      format: "markdown",
      level: rawLevel,
    });
  }

  const overviewSection =
    overviewContent || sections.length === 0
      ? [
          {
            title: "Overview",
            anchor: "overview",
            content: overviewContent || body,
            format: "markdown" as const,
            level: 1,
          },
        ]
      : [];

  return [...overviewSection, ...sections].filter((section) => section.content.trim() || section.title);
}

function getDocumentExtension(document: DocumentDetail): string | null {
  const extension = document.metadata?.extension;
  return typeof extension === "string" ? extension.toLowerCase() : null;
}

function MarkdownHeading({
  children,
  level,
}: {
  children: ReactNode;
  level: 1 | 2 | 3 | 4;
}) {
  const text = extractNodeText(children);
  const anchor = slugifyText(text || `section-${level}`);
  const renderLevel = Math.min(level + 1, 4) as 2 | 3 | 4;
  const Tag = `h${renderLevel}` as const;

  return (
    <Tag id={anchor} className="reader-heading scroll-mt-24">
      <a href={`#${anchor}`} className="reader-heading-link">
        <span>{children}</span>
      </a>
    </Tag>
  );
}

function extractNodeText(children: ReactNode, options?: { preserveWhitespace?: boolean }): string {
  const text = Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      if (isValidElement<{ children?: ReactNode }>(child)) {
        return extractNodeText(child.props.children, options);
      }
      return "";
    })
    .join(options?.preserveWhitespace ? "" : " ");

  return options?.preserveWhitespace ? text : text.replace(/\s+/g, " ").trim();
}

function extractMarkdownLanguage(children: ReactNode): string | null {
  const child = Children.toArray(children)[0];
  if (!isValidElement<{ className?: string }>(child)) {
    return null;
  }

  const className = child.props.className ?? "";
  const match = className.match(/language-([\w-]+)/i) ?? className.match(/lang-([\w-]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}
