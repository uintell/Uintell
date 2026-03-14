import Link from "next/link";
import {
  BookOpenText,
  ChevronRight,
  FileClock,
  LayoutGrid,
  type LucideIcon,
  Menu,
  Search,
  Settings2,
  Sparkles,
  Wrench,
} from "lucide-react";

import { LogoMark } from "@/components/logo-mark";

const leftRailSections = [
  {
    title: "Navigation",
    items: [
      { href: "/", label: "Main page" },
      { href: "/app", label: "Workspace" },
      { href: "/login", label: "Log in" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: "/app/chat", label: "Chat" },
      { href: "/app/search", label: "Search" },
      { href: "/app/library", label: "Library" },
      { href: "/app/collections", label: "Collections" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/app/notes", label: "Pages" },
      { href: "/app/settings", label: "Settings" },
      { href: "/app/admin", label: "Admin" },
    ],
  },
];

const pageTabs = [
  { label: "Read", active: true },
  { label: "View source", active: false },
  { label: "View history", active: false },
];

const contents = [
  { href: "#welcome", label: "Welcome" },
  { href: "#intelligence-hub", label: "Intelligence hub" },
  { href: "#knowledge-base", label: "Knowledge base" },
  { href: "#workspace-tools", label: "Workspace tools" },
];

const toolLinks = [
  { href: "/app/search", label: "Search documents", icon: Search },
  { href: "/app/library", label: "Browse library", icon: BookOpenText },
  { href: "/app/collections", label: "Open collections", icon: LayoutGrid },
  { href: "/app/settings", label: "Adjust settings", icon: Settings2 },
];

const articleCards = [
  {
    id: "intelligence-hub",
    eyebrow: "From United Intelligence",
    title: "Intelligence hub",
    body:
      "Move between live chat, hybrid search, and saved collections from one front page, using the familiar wiki-style structure as the starting point.",
    links: [
      { href: "/app/chat", label: "Open chat" },
      { href: "/app/search", label: "Run search" },
    ],
    icon: Sparkles,
  },
  {
    id: "knowledge-base",
    eyebrow: "Featured knowledge",
    title: "Knowledge base",
    body:
      "Review ingested sources, knowledge pages, and curated reading paths in a layout designed for dense knowledge browsing and quick scanning.",
    links: [
      { href: "/app/library", label: "Browse library" },
      { href: "/app/notes", label: "Read pages" },
    ],
    icon: BookOpenText,
  },
  {
    id: "workspace-tools",
    eyebrow: "Workspace tools",
    title: "Operational controls",
    body:
      "Reach admin controls, ingestion settings, and collection management from the same shell without losing the structure of the main page.",
    links: [
      { href: "/app/settings", label: "Open settings" },
      { href: "/app/admin", label: "Admin panel" },
    ],
    icon: Wrench,
  },
  {
    id: "recent-activity",
    eyebrow: "Recent activity",
    title: "Current workstreams",
    body:
      "Use the landing page as a routing layer into current research, saved artifacts, and the areas of the product that are already implemented.",
    links: [
      { href: "/app/collections", label: "View collections" },
      { href: "/app", label: "Open workspace" },
    ],
    icon: FileClock,
  },
];

export function LandingPage() {
  return (
    <main className="min-h-screen bg-[#020704] text-[#7df2a6]">
      <header className="border-b border-[#12311d] bg-[#050b08]">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2 sm:px-4 lg:px-6">
          <details className="relative lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-[#1a4029] bg-[#08110d] px-3 py-2 text-sm font-medium text-[#7df2a6] [&::-webkit-details-marker]:hidden">
              <Menu className="h-4 w-4" />
              Menu
            </summary>
            <div className="absolute left-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-md border border-[#12311d] bg-[#050b08] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
              <div className="space-y-6">
                {leftRailSections.map((section) => (
                  <RailSection key={section.title} title={section.title} items={section.items} />
                ))}
              </div>
            </div>
          </details>

          <div className="hidden min-w-[170px] lg:block">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#5faa73]">United Intelligence</div>
            <div className="mt-1 text-sm text-[#7df2a6]">Main page</div>
          </div>

          <form action="/app/search" className="flex-1" role="search">
            <label htmlFor="landing-search" className="sr-only">
              Search United Intelligence
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4e7960]" />
              <input
                id="landing-search"
                name="q"
                type="search"
                placeholder="Search United Intelligence"
                className="h-10 w-full rounded-md border border-[#1a4029] bg-[#030806] pl-10 pr-4 text-sm text-[#7df2a6] outline-none transition placeholder:text-[#4e7960] focus:border-[#4d8dff] focus:ring-2 focus:ring-[#4d8dff]/20"
              />
            </div>
          </form>

          <nav className="hidden items-center gap-4 text-sm text-[#4d8dff] md:flex">
            <Link href="/app" className="transition hover:text-[#7aaaff]">
              Open workspace
            </Link>
            <Link href="/login" className="transition hover:text-[#7aaaff]">
              Log in
            </Link>
          </nav>
        </div>
      </header>

      <div className="border-b border-[#12311d] bg-[#030806]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
          <nav className="flex min-h-12 flex-wrap items-end gap-1 overflow-x-auto pt-3 text-sm">
            {pageTabs.map((tab) => (
              <button
                key={tab.label}
                type="button"
                aria-current={tab.active ? "page" : undefined}
                className={[
                  "rounded-t-md border border-b-0 px-4 py-2 transition",
                  tab.active
                    ? "border-[#1a4029] bg-[#020704] font-medium text-[#7df2a6]"
                    : "border-transparent text-[#4d8dff] hover:bg-[#08110d]",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-4 text-sm text-[#5faa73] lg:flex">
            <span>Tools</span>
            <span>Languages</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4 lg:px-6">
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_240px]">
          <aside className="hidden lg:block">
            <div className="sticky top-4 space-y-6">
              {leftRailSections.map((section) => (
                <RailSection key={section.title} title={section.title} items={section.items} />
              ))}
            </div>
          </aside>

          <article className="min-w-0 border border-[#12311d] bg-[#050b08] shadow-[0_1px_1px_rgba(0,0,0,0.25)]">
            <div className="border-b border-[#12311d] px-4 py-5 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-[#5faa73]">Main page</div>
                  <h1 className="mt-1 text-3xl font-normal text-[#7df2a6]">United Intelligence</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66c485]">
                    A structured front page for navigating chat, search, collections, and the knowledge base, while keeping
                    the current logo centered in the article body.
                  </p>
                </div>

                <div className="grid gap-2 text-sm text-[#4d8dff] sm:grid-cols-2">
                  <Link href="/app" className="rounded border border-[#1a4029] bg-[#08110d] px-3 py-2 transition hover:bg-[#0d1712] hover:text-[#7aaaff]">
                    Open workspace
                  </Link>
                  <Link href="/app/search" className="rounded border border-[#1a4029] bg-[#08110d] px-3 py-2 transition hover:bg-[#0d1712] hover:text-[#7aaaff]">
                    Search knowledge
                  </Link>
                </div>
              </div>
            </div>

            <div className="px-4 py-5 sm:px-6">
              <div className="mb-6 grid gap-3 xl:hidden">
                <details className="rounded-md border border-[#12311d] bg-[#08110d]">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-[#7df2a6] [&::-webkit-details-marker]:hidden">
                    Contents
                  </summary>
                  <div className="border-t border-[#12311d] px-4 py-3">
                    <ContentsList />
                  </div>
                </details>

                <details className="rounded-md border border-[#12311d] bg-[#08110d]">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-[#7df2a6] [&::-webkit-details-marker]:hidden">
                    Tools
                  </summary>
                  <div className="border-t border-[#12311d] px-4 py-3">
                    <ToolsList />
                  </div>
                </details>
              </div>

              <section
                id="welcome"
                className="rounded-sm border border-[#1a4029] bg-[linear-gradient(180deg,#08110d_0%,#030806_100%)] px-6 py-10 sm:px-10"
              >
                <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
                  <LogoMark size={144} />
                  <div className="mt-5 text-xl font-semibold tracking-[0.22em] text-[#00a126] sm:text-2xl">United Intelligence</div>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-[#66c485]">
                    This front page uses persistent navigation, article tabs, contents, and utility rails around a central
                    document surface.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
                    <QuickLink href="/app/chat" icon={Sparkles} label="Start a chat" />
                    <QuickLink href="/app/search" icon={Search} label="Search sources" />
                    <QuickLink href="/app/library" icon={BookOpenText} label="Open library" />
                  </div>
                </div>
              </section>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {articleCards.map((card) => (
                  <section key={card.id} id={card.id} className="border border-[#1a4029] bg-[#08110d]">
                    <div className="border-b border-[#12311d] bg-[#050b08] px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-[#5faa73]">{card.eyebrow}</div>
                      <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-[#7df2a6]">
                        <card.icon className="h-4 w-4 text-[#7df2a6]" />
                        {card.title}
                      </div>
                    </div>
                    <div className="space-y-4 px-4 py-4 text-sm leading-6 text-[#66c485]">
                      <p>{card.body}</p>
                      <div className="flex flex-wrap gap-4 text-[#4d8dff]">
                        {card.links.map((link) => (
                          <Link key={link.href} href={link.href} className="inline-flex items-center gap-1 transition hover:text-[#7aaaff]">
                            {link.label}
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </article>

          <aside className="hidden xl:block">
            <div className="sticky top-4 space-y-4">
              <div className="border border-[#12311d] bg-[#050b08]">
                <div className="border-b border-[#12311d] px-4 py-3 text-sm font-semibold text-[#7df2a6]">Contents</div>
                <div className="px-4 py-3">
                  <ContentsList />
                </div>
              </div>

              <div className="border border-[#12311d] bg-[#050b08]">
                <div className="border-b border-[#12311d] px-4 py-3 text-sm font-semibold text-[#7df2a6]">Tools</div>
                <div className="px-4 py-3">
                  <ToolsList />
                </div>
              </div>

              <div className="border border-[#12311d] bg-[#050b08]">
                <div className="border-b border-[#12311d] px-4 py-3 text-sm font-semibold text-[#7df2a6]">Appearance</div>
                <div className="space-y-3 px-4 py-3 text-sm text-[#66c485]">
                  <div className="rounded border border-[#1a4029] bg-[#08110d] px-3 py-2">Text size: Standard</div>
                  <div className="rounded border border-[#1a4029] bg-[#08110d] px-3 py-2">Width: Full article</div>
                  <div className="rounded border border-[#1a4029] bg-[#08110d] px-3 py-2">Theme: Uintell dark</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function RailSection({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string }[];
}) {
  return (
    <section className="border border-[#12311d] bg-[#050b08]">
      <div className="border-b border-[#12311d] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[#5faa73]">{title}</div>
      <nav className="px-4 py-3">
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="text-[#4d8dff] transition hover:text-[#7aaaff]">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

function ContentsList() {
  return (
    <nav aria-label="Contents">
      <ul className="space-y-2 text-sm">
        {contents.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-[#4d8dff] transition hover:text-[#7aaaff]">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ToolsList() {
  return (
    <nav aria-label="Tools">
      <ul className="space-y-3 text-sm">
        {toolLinks.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex items-center gap-2 text-[#4d8dff] transition hover:text-[#7aaaff]">
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-[#1a4029] bg-[#050b08] px-4 py-2 text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
