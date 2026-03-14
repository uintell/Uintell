use std::{
    collections::HashMap,
    env,
    net::SocketAddr,
    sync::{Arc, Mutex},
};

use axum::{
    Router,
    extract::{Query, State},
    http::header,
    response::{Html, IntoResponse},
    routing::get,
};
use serde::Deserialize;
use tokio::{net::TcpListener, signal, task};
use tower_http::trace::TraceLayer;
use tracing::info;
use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};
use united_intelligence::{logo, wiki};

struct MessengerChannel {
    label: &'static str,
    detail: &'static str,
    url_env: &'static str,
}

#[derive(Clone, Default)]
struct AppState {
    previews: PreviewStore,
}

#[derive(Clone, Default)]
struct PreviewStore {
    entries: Arc<Mutex<HashMap<String, PreviewEntry>>>,
}

#[derive(Clone)]
enum PreviewEntry {
    Loading,
    Ready(wiki::ArticlePreview),
    Missing,
    Failed(String),
}

impl PreviewStore {
    fn get(&self, title: &str) -> Option<PreviewEntry> {
        self.entries.lock().ok()?.get(title).cloned()
    }

    fn begin_loading(&self, title: &str) -> bool {
        let Ok(mut entries) = self.entries.lock() else {
            return false;
        };

        if entries.contains_key(title) {
            return false;
        }

        entries.insert(title.to_owned(), PreviewEntry::Loading);
        true
    }

    fn finish(&self, title: String, entry: PreviewEntry) {
        if let Ok(mut entries) = self.entries.lock() {
            entries.insert(title, entry);
        }
    }
}

const MESSENGER_CHANNELS: &[MessengerChannel] = &[
    MessengerChannel {
        label: "Signal",
        detail: "Encrypted direct line",
        url_env: "UINTELL_SIGNAL_URL",
    },
    MessengerChannel {
        label: "Telegram",
        detail: "Fast public channel",
        url_env: "UINTELL_TELEGRAM_URL",
    },
    MessengerChannel {
        label: "WhatsApp",
        detail: "Mobile contact route",
        url_env: "UINTELL_WHATSAPP_URL",
    },
    MessengerChannel {
        label: "Email",
        detail: "Formal inbound contact",
        url_env: "UINTELL_EMAIL_URL",
    },
];

#[derive(Deserialize)]
struct SearchParams {
    q: Option<String>,
}

#[derive(Deserialize)]
struct ArticleParams {
    title: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_tracing();
    let state = AppState::default();

    let app = Router::new()
        .route("/", get(home_page))
        .route("/search", get(search_page))
        .route("/wiki/article", get(wiki_article_page))
        .route("/healthz", get(|| async { "ok" }))
        .route("/logo.svg", get(logo_svg))
        .route("/runtime-logo.svg", get(logo_svg))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = app_addr()?;
    let listener = TcpListener::bind(addr).await?;
    info!(%addr, "united intelligence listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

fn init_tracing() {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,tower_http=info".into()))
        .with(fmt::layer())
        .init();
}

fn app_addr() -> Result<SocketAddr, Box<dyn std::error::Error>> {
    let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_owned());
    let port = env::var("PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(3001);

    Ok(format!("{host}:{port}").parse()?)
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("installing Ctrl+C handler should succeed");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("installing SIGTERM handler should succeed")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {}
        _ = terminate => {}
    }
}

async fn home_page() -> Html<String> {
    let info = wiki::dump_info();
    let content = format!(
        "{}{}{}",
        render_search_panel(""),
        render_home_copy(),
        render_dump_status(&info)
    );

    render_page("United Intelligence", &render_mark(None, &content))
}

async fn search_page(Query(params): Query<SearchParams>) -> Html<String> {
    let query = params.q.unwrap_or_default();
    let normalized = query.trim().to_owned();
    let info = wiki::dump_info();

    let results_markup = if normalized.is_empty() {
        render_search_idle()
    } else {
        match task::spawn_blocking({
            let query = normalized.clone();
            move || wiki::search(&query, wiki::DEFAULT_SEARCH_LIMIT)
        })
        .await
        {
            Ok(Ok(outcome)) => render_search_results(&normalized, &outcome),
            Ok(Err(wiki::Error::TitleIndexMissing {
                final_path,
                temp_path,
            })) => render_error_state(&format!(
                "The Wikipedia title index is not ready yet. Expected final index: {}. Temporary index path: {}.",
                escape_html(&final_path.display().to_string()),
                escape_html(&temp_path.display().to_string())
            )),
            Ok(Err(err)) => render_error_state(&format!(
                "Search failed for \"{}\": {}",
                escape_html(&normalized),
                escape_html(&err.to_string())
            )),
            Err(err) => render_error_state(&format!(
                "Search task failed for \"{}\": {}",
                escape_html(&normalized),
                escape_html(&err.to_string())
            )),
        }
    };

    let content = format!(
        "{}{}{}",
        render_search_panel(&query),
        render_dump_status(&info),
        results_markup
    );

    render_page(
        "Search | United Intelligence",
        &render_mark(Some("search-page"), &content),
    )
}

async fn wiki_article_page(
    State(state): State<AppState>,
    Query(params): Query<ArticleParams>,
) -> Html<String> {
    let title = params.title.unwrap_or_default();
    let normalized = title.trim().to_owned();
    let info = wiki::dump_info();

    let article_markup = if normalized.is_empty() {
        render_error_state("No Wikipedia title was supplied.")
    } else {
        match state.previews.get(&normalized) {
            Some(PreviewEntry::Ready(article)) => render_article_preview(&article),
            Some(PreviewEntry::Missing) => render_error_state(&format!(
                "No article titled \"{}\" was found in the local dump.",
                escape_html(&normalized)
            )),
            Some(PreviewEntry::Failed(message)) => render_error_state(&format!(
                "Preview load failed for \"{}\": {}",
                escape_html(&normalized),
                escape_html(&message)
            )),
            Some(PreviewEntry::Loading) => render_preview_loading_state(&normalized),
            None => {
                if state.previews.begin_loading(&normalized) {
                    let requested_title = normalized.clone();
                    let result = task::spawn_blocking(move || {
                        wiki::load_article_preview(&requested_title, wiki::DEFAULT_PREVIEW_BYTES)
                    })
                    .await;

                    let entry = match result {
                        Ok(Ok(Some(article))) => PreviewEntry::Ready(article),
                        Ok(Ok(None)) => PreviewEntry::Missing,
                        Ok(Err(err)) => PreviewEntry::Failed(err.to_string()),
                        Err(err) => PreviewEntry::Failed(err.to_string()),
                    };

                    state.previews.finish(normalized.clone(), entry.clone());

                    match entry {
                        PreviewEntry::Ready(article) => render_article_preview(&article),
                        PreviewEntry::Missing => render_error_state(&format!(
                            "No article titled \"{}\" was found in the local dump.",
                            escape_html(&normalized)
                        )),
                        PreviewEntry::Failed(message) => render_error_state(&format!(
                            "Preview load failed for \"{}\": {}",
                            escape_html(&normalized),
                            escape_html(&message)
                        )),
                        PreviewEntry::Loading => render_preview_loading_state(&normalized),
                    }
                } else {
                    render_preview_loading_state(&normalized)
                }
            }
        }
    };

    let content = format!(
        "{}{}{}",
        render_search_panel(&title),
        render_dump_status(&info),
        article_markup
    );

    let page_title = if normalized.is_empty() {
        String::from("Wikipedia Preview | United Intelligence")
    } else {
        format!("{} | United Intelligence", normalized)
    };

    render_page(&page_title, &render_mark(Some("search-page"), &content))
}

fn render_page(title: &str, body_content: &str) -> Html<String> {
    let html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    <meta name="description" content="United Intelligence">
    <link rel="icon" type="image/svg+xml" href="/runtime-logo.svg">
    <style>
        * {{
            box-sizing: border-box;
        }}

        :root {{
            color-scheme: dark;
        }}

        body {{
            margin: 0;
            min-height: 100vh;
            background: #000;
            color: #00ff33;
            font-family: "JetBrains Mono", "Fira Code", monospace;
        }}

        main {{
            min-height: 100vh;
            padding: 1.75rem 1rem 1rem;
        }}

        .page-shell {{
            width: min(1180px, 100%);
            margin: 0 auto;
            display: grid;
            grid-template-columns: minmax(0, 1fr) 280px;
            gap: 1.25rem;
            align-items: flex-start;
        }}

        .page-primary {{
            display: flex;
            justify-content: center;
        }}

        .mark {{
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.85rem;
            width: min(100%, 820px);
        }}

        .logo {{
            width: min(28vw, 120px);
            min-width: 72px;
        }}

        .logo svg {{
            display: block;
            width: 100%;
            height: auto;
        }}

        .name {{
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.22em;
            font-size: clamp(0.9rem, 1.8vw, 1.2rem);
            text-align: center;
        }}

        .search-panel {{
            width: min(100%, 820px);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.75rem;
        }}

        .search-form {{
            display: flex;
            align-items: stretch;
            width: min(100%, 580px);
            margin-top: 0.4rem;
            border: 1px solid #00ff33;
            border-radius: 999px;
            overflow: hidden;
            background: rgba(0, 0, 0, 0.96);
            box-shadow: 0 0 0 1px rgba(0, 255, 51, 0.12);
        }}

        .search-input {{
            flex: 1;
            min-width: 0;
            border: 0;
            padding: 0.95rem 1.1rem;
            background: transparent;
            color: #00ff33;
            font: inherit;
            font-size: 0.95rem;
            outline: none;
        }}

        .search-input::placeholder {{
            color: rgba(0, 255, 51, 0.58);
        }}

        .search-button {{
            border: 0;
            border-left: 1px solid rgba(0, 255, 51, 0.22);
            padding: 0 1.2rem;
            background: #00ff33;
            color: #000;
            font: inherit;
            font-size: 0.85rem;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            cursor: pointer;
        }}

        .panel-copy {{
            margin: 0;
            color: rgba(0, 255, 51, 0.74);
            font-size: 0.84rem;
            line-height: 1.5;
            text-align: center;
            max-width: 50rem;
        }}

        .status-card {{
            width: min(100%, 820px);
            padding: 1rem 1.1rem;
            border: 1px solid rgba(0, 255, 51, 0.18);
            border-radius: 24px;
            background: rgba(0, 255, 51, 0.04);
            display: grid;
            gap: 0.8rem;
        }}

        .status-kicker {{
            margin: 0;
            color: rgba(0, 255, 51, 0.64);
            font-size: 0.72rem;
            letter-spacing: 0.16em;
            text-transform: uppercase;
        }}

        .status-title {{
            margin: 0;
            font-size: 0.98rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }}

        .status-copy {{
            margin: 0;
            color: rgba(0, 255, 51, 0.74);
            line-height: 1.55;
            font-size: 0.84rem;
        }}

        .status-grid {{
            display: grid;
            gap: 0.6rem;
        }}

        .status-row {{
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            align-items: center;
            color: rgba(0, 255, 51, 0.88);
            font-size: 0.82rem;
        }}

        .status-chip {{
            display: inline-flex;
            align-items: center;
            padding: 0.18rem 0.48rem;
            border: 1px solid rgba(0, 255, 51, 0.22);
            border-radius: 999px;
            color: rgba(0, 255, 51, 0.84);
            font-size: 0.72rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }}

        .results-copy {{
            margin: 0;
            color: rgba(0, 255, 51, 0.8);
            font-size: 0.9rem;
            line-height: 1.55;
            text-align: center;
        }}

        .query {{
            color: #00ff33;
        }}

        .results {{
            width: min(100%, 820px);
            display: grid;
            gap: 0.85rem;
        }}

        .result-card {{
            padding: 1rem 1.1rem;
            border: 1px solid rgba(0, 255, 51, 0.22);
            border-radius: 20px;
            background: rgba(0, 255, 51, 0.04);
        }}

        .result-kicker {{
            margin: 0 0 0.45rem;
            color: rgba(0, 255, 51, 0.58);
            font-size: 0.72rem;
            letter-spacing: 0.16em;
            text-transform: uppercase;
        }}

        .result-title {{
            margin: 0 0 0.35rem;
            font-size: 1rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }}

        .result-url {{
            margin: 0 0 0.55rem;
            color: rgba(0, 255, 51, 0.72);
            font-size: 0.78rem;
            word-break: break-word;
        }}

        .result-description {{
            margin: 0;
            color: rgba(0, 255, 51, 0.86);
            line-height: 1.55;
            font-size: 0.92rem;
        }}

        .result-actions {{
            display: flex;
            flex-wrap: wrap;
            gap: 0.65rem;
            margin-top: 0.85rem;
        }}

        .action-link {{
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 2.25rem;
            padding: 0.55rem 0.8rem;
            border: 1px solid rgba(0, 255, 51, 0.24);
            border-radius: 999px;
            color: #000;
            background: #00ff33;
            text-decoration: none;
            font-size: 0.78rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }}

        .action-link-secondary {{
            color: #00ff33;
            background: transparent;
        }}

        .article-panel {{
            width: min(100%, 820px);
            padding: 1rem 1.1rem 1.1rem;
            border: 1px solid rgba(0, 255, 51, 0.22);
            border-radius: 24px;
            background: rgba(0, 255, 51, 0.04);
            display: grid;
            gap: 0.85rem;
        }}

        .page-title {{
            margin: 0;
            font-size: clamp(1.1rem, 2vw, 1.5rem);
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }}

        .wiki-preview {{
            margin: 0;
            padding: 1rem;
            border: 1px solid rgba(0, 255, 51, 0.16);
            border-radius: 18px;
            background: rgba(0, 0, 0, 0.72);
            color: rgba(0, 255, 51, 0.9);
            font: inherit;
            font-size: 0.84rem;
            line-height: 1.55;
            white-space: pre-wrap;
            word-break: break-word;
        }}

        .search-page {{
            gap: 1rem;
        }}

        .messenger-menu {{
            position: sticky;
            top: 1rem;
            padding: 1rem;
            border: 1px solid rgba(0, 255, 51, 0.22);
            border-radius: 26px;
            background:
                linear-gradient(180deg, rgba(0, 255, 51, 0.08), rgba(0, 0, 0, 0.96)),
                #000;
            box-shadow:
                0 0 0 1px rgba(0, 255, 51, 0.08),
                0 18px 40px rgba(0, 0, 0, 0.32);
        }}

        .messenger-kicker {{
            display: inline-block;
            margin: 0 0 0.55rem;
            color: rgba(0, 255, 51, 0.62);
            font-size: 0.72rem;
            letter-spacing: 0.16em;
            text-transform: uppercase;
        }}

        .messenger-title {{
            margin: 0;
            font-size: 1rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }}

        .messenger-copy {{
            margin: 0.45rem 0 0;
            color: rgba(0, 255, 51, 0.74);
            line-height: 1.55;
            font-size: 0.84rem;
        }}

        .messenger-list {{
            margin-top: 1rem;
            display: grid;
            gap: 0.7rem;
        }}

        .messenger-link {{
            display: grid;
            gap: 0.28rem;
            padding: 0.85rem 0.9rem;
            border: 1px solid rgba(0, 255, 51, 0.18);
            border-radius: 18px;
            background: rgba(0, 255, 51, 0.04);
            color: inherit;
            text-decoration: none;
            transition:
                border-color 120ms ease,
                background 120ms ease,
                transform 120ms ease;
        }}

        .messenger-link:hover {{
            border-color: rgba(0, 255, 51, 0.42);
            background: rgba(0, 255, 51, 0.1);
            transform: translateX(-2px);
        }}

        .messenger-link-disabled {{
            opacity: 0.72;
            cursor: default;
        }}

        .messenger-link-disabled:hover {{
            transform: none;
            border-color: rgba(0, 255, 51, 0.18);
            background: rgba(0, 255, 51, 0.04);
        }}

        .messenger-label {{
            font-size: 0.92rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }}

        .messenger-detail {{
            color: rgba(0, 255, 51, 0.72);
            font-size: 0.78rem;
        }}

        .messenger-status {{
            color: rgba(0, 255, 51, 0.9);
            font-size: 0.72rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }}

        .messenger-note {{
            margin: 0.95rem 0 0;
            color: rgba(0, 255, 51, 0.56);
            line-height: 1.5;
            font-size: 0.76rem;
        }}

        @media (max-width: 960px) {{
            .page-shell {{
                grid-template-columns: 1fr;
            }}

            .messenger-menu {{
                position: static;
                width: min(100%, 820px);
                justify-self: center;
            }}
        }}

        @media (max-width: 640px) {{
            main {{
                padding-top: 1.25rem;
            }}

            .logo {{
                width: min(34vw, 96px);
            }}

            .name {{
                letter-spacing: 0.16em;
                font-size: 0.82rem;
            }}

            .search-form {{
                width: min(100%, 420px);
            }}

            .search-input {{
                padding: 0.9rem 1rem;
                font-size: 0.9rem;
            }}

            .search-button {{
                padding: 0 1rem;
                font-size: 0.76rem;
            }}

            .results-copy,
            .status-copy {{
                font-size: 0.84rem;
            }}

            .result-card,
            .article-panel {{
                padding: 0.9rem 1rem;
            }}

            .messenger-menu {{
                padding: 0.9rem;
                border-radius: 22px;
            }}
        }}
    </style>
</head>
<body>
    <main>
        <div class="page-shell">
            <div class="page-primary">{}</div>
            {}
        </div>
    </main>
</body>
</html>"#,
        escape_html(title),
        body_content,
        render_messenger_menu()
    );

    Html(html)
}

fn render_mark(extra_class: Option<&str>, content: &str) -> String {
    let class_name = match extra_class {
        Some(extra) if !extra.is_empty() => format!("mark {extra}"),
        _ => String::from("mark"),
    };

    format!(
        r#"<section class="{class_name}" aria-label="United Intelligence">
            <div class="logo">{logo}</div>
            <p class="name">United Intelligence</p>
            {content}
        </section>"#,
        class_name = class_name,
        logo = logo::render_logo_svg(),
        content = content
    )
}

fn render_search_panel(query: &str) -> String {
    format!(
        r#"<div class="search-panel">
            <form class="search-form" action="/search" method="get">
                <input
                    class="search-input"
                    type="search"
                    name="q"
                    value="{query}"
                    placeholder="Search Wikipedia titles"
                    aria-label="Search the local Wikipedia dump"
                    autocomplete="off"
                >
                <button class="search-button" type="submit">Search</button>
            </form>
            <p class="panel-copy">Search article titles from the local English Wikipedia multistream dump and open raw previews directly on this site.</p>
        </div>"#,
        query = escape_attribute(query)
    )
}

fn render_home_copy() -> String {
    String::from(
        r#"<p class="results-copy">The search bar is wired to the local <span class="query">enwiki-latest-pages-articles-multistream.xml.bz2</span> dump. Search results and article pages stay on this site.</p>"#,
    )
}

fn render_search_idle() -> String {
    String::from(
        r#"<p class="results-copy">Enter a title or phrase to search article names inside the local English Wikipedia dump.</p>"#,
    )
}

fn render_dump_status(info: &wiki::DumpInfo) -> String {
    let dump_state = if info.dump_exists { "ready" } else { "missing" };
    let index_state = if info.title_index_exists {
        "ready"
    } else if info.title_index_temp_exists {
        "building"
    } else {
        "not built"
    };
    let article_index_state = if info.stream_index_exists {
        "ready"
    } else {
        "missing"
    };
    let dump_size = info
        .dump_size_bytes
        .map(format_bytes)
        .unwrap_or_else(|| String::from("unknown"));
    let article_index_size = info
        .stream_index_size_bytes
        .map(format_bytes)
        .unwrap_or_else(|| String::from("size unknown"));
    let index_target = if info.title_index_exists {
        info.title_index_path.display().to_string()
    } else if info.title_index_temp_exists {
        format!(
            "{} ({})",
            info.title_index_temp_path.display(),
            info.title_index_temp_size_bytes
                .map(format_bytes)
                .unwrap_or_else(|| String::from("size unknown"))
        )
    } else {
        info.title_index_path.display().to_string()
    };
    let article_index_target = if info.stream_index_exists {
        format!(
            "{} ({})",
            info.stream_index_path.display(),
            article_index_size
        )
    } else {
        info.stream_index_path.display().to_string()
    };

    format!(
        r#"<section class="status-card" aria-label="Wikipedia dump status">
            <p class="status-kicker">Wikipedia Dump</p>
            <h2 class="status-title">Local search source</h2>
            <p class="status-copy">Queries search article titles through the generated local title index. Article pages use the multistream offset index to jump directly into the compressed dump instead of scanning the full file from the start.</p>
            <div class="status-grid">
                <div class="status-row">
                    <span class="status-chip">Dump {dump_state}</span>
                    <span>{dump_name}</span>
                    <span>Size {dump_size}</span>
                </div>
                <div class="status-row">
                    <span class="status-chip">Index {index_state}</span>
                    <span>{index_target}</span>
                </div>
                <div class="status-row">
                    <span class="status-chip">Article index {article_index_state}</span>
                    <span>{article_index_target}</span>
                </div>
            </div>
        </section>"#,
        dump_state = dump_state,
        dump_name = escape_html(&info.dump_path.display().to_string()),
        dump_size = escape_html(&dump_size),
        index_state = index_state,
        index_target = escape_html(&index_target),
        article_index_state = article_index_state,
        article_index_target = escape_html(&article_index_target),
    )
}

fn render_search_results(query: &str, outcome: &wiki::SearchOutcome) -> String {
    if outcome.hits.is_empty() {
        return format!(
            r#"<p class="results-copy">No article titles matched "<span class="query">{query}</span>" via {source}.</p>"#,
            query = escape_html(query),
            source = escape_html(outcome.source.label())
        );
    }

    format!(
        r#"<p class="results-copy">{count} Wikipedia title result{suffix} for "<span class="query">{query}</span>" via {source}.</p>{cards}"#,
        count = outcome.hits.len(),
        suffix = if outcome.hits.len() == 1 { "" } else { "s" },
        query = escape_html(query),
        source = escape_html(outcome.source.label()),
        cards = render_result_cards(&outcome.hits),
    )
}

fn render_result_cards(results: &[wiki::SearchHit]) -> String {
    let mut html = String::from(r#"<div class="results">"#);

    for result in results {
        html.push_str(&format!(
            r#"<article class="result-card">
                <p class="result-kicker">Local article</p>
                <h2 class="result-title">{title}</h2>
                <p class="result-url">{local_display}</p>
                <p class="result-description">Matched in the local English Wikipedia dump. Opening the result keeps the reader on this site and loads the article from the local multistream dump.</p>
                <div class="result-actions">
                    <a class="action-link" href="{local_href}">Open on this site</a>
                </div>
            </article>"#,
            title = escape_html(&result.title),
            local_display = escape_html(&result.local_url),
            local_href = escape_attribute(&result.local_url),
        ));
    }

    html.push_str("</div>");
    html
}

fn render_article_preview(article: &wiki::ArticlePreview) -> String {
    let local_url = wiki::article_path(&article.title);
    let redirect_note = match article.redirect.as_deref() {
        Some(target) => format!(
            r#"<p class="results-copy">Redirect target: <span class="query">{}</span></p>"#,
            escape_html(target)
        ),
        None => String::new(),
    };

    let preview_markup = if article.preview.is_empty() {
        String::from(r#"<p class="results-copy">No text excerpt was captured for this page.</p>"#)
    } else {
        format!(
            r#"<pre class="wiki-preview">{}</pre>"#,
            escape_html(&article.preview)
        )
    };

    format!(
        r#"<section class="article-panel" aria-label="Local article preview">
            <p class="result-kicker">Hosted preview</p>
            <h2 class="page-title">{title}</h2>
            <p class="result-url">{local_url}</p>
            <p class="results-copy">Showing a raw wikitext excerpt from the local dump on this site.</p>
            {redirect_note}
            <div class="result-actions">
                <a class="action-link" href="{search_url}">Back to results</a>
            </div>
            {preview}
        </section>"#,
        title = escape_html(&article.title),
        local_url = escape_html(&local_url),
        redirect_note = redirect_note,
        search_url = escape_attribute(&wiki::search_url(&article.title)),
        preview = preview_markup,
    )
}

fn render_preview_loading_state(title: &str) -> String {
    let local_url = wiki::article_path(title);

    format!(
        r#"<section class="status-card" aria-label="Local preview loading">
            <p class="status-kicker">Local Preview</p>
            <h2 class="status-title">Preparing</h2>
            <p class="status-copy">The local page for "<span class="query">{title}</span>" is being extracted from the compressed Wikipedia dump. This page will refresh automatically.</p>
            <div class="result-actions">
                <a class="action-link" href="{local_url}">Refresh preview</a>
            </div>
        </section>
        <script>
            setTimeout(function () {{
                window.location.reload();
            }}, 3000);
        </script>"#,
        title = escape_html(title),
        local_url = escape_attribute(&local_url),
    )
}

fn render_error_state(message: &str) -> String {
    format!(
        r#"<section class="status-card" aria-label="Search error">
            <p class="status-kicker">Search State</p>
            <h2 class="status-title">Unavailable</h2>
            <p class="status-copy">{}</p>
        </section>"#,
        message
    )
}

fn render_messenger_menu() -> String {
    let mut html = String::from(
        r#"<aside class="messenger-menu" aria-label="Messenger menu">
            <span class="messenger-kicker">Channels</span>
            <h2 class="messenger-title">Messenger</h2>
            <p class="messenger-copy">A dedicated contact rail sits on the right side of the page. Active routes open directly; inactive routes stay parked until they go live.</p>
            <nav class="messenger-list" aria-label="Messenger channels">"#,
    );

    for channel in MESSENGER_CHANNELS {
        let url = env::var(channel.url_env)
            .ok()
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty());

        match url {
            Some(url) => html.push_str(&format!(
                r#"<a class="messenger-link" href="{href}" target="_blank" rel="noreferrer noopener">
                    <span class="messenger-label">{label}</span>
                    <span class="messenger-detail">{detail}</span>
                    <span class="messenger-status">Open</span>
                </a>"#,
                href = escape_attribute(&url),
                label = escape_html(channel.label),
                detail = escape_html(channel.detail)
            )),
            None => html.push_str(&format!(
                r#"<div class="messenger-link messenger-link-disabled" aria-disabled="true">
                    <span class="messenger-label">{label}</span>
                    <span class="messenger-detail">{detail}</span>
                    <span class="messenger-status">Offline</span>
                </div>"#,
                label = escape_html(channel.label),
                detail = escape_html(channel.detail)
            )),
        }
    }

    html.push_str(
        r#"</nav>
            <p class="messenger-note">Signal, Telegram, WhatsApp, and email slots are ready for live links.</p>
        </aside>"#,
    );

    html
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn escape_attribute(value: &str) -> String {
    escape_html(value).replace('\'', "&#39;")
}

fn format_bytes(size: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];

    let mut value = size as f64;
    let mut unit = UNITS[0];

    for next_unit in UNITS.iter().skip(1) {
        if value < 1024.0 {
            break;
        }
        value /= 1024.0;
        unit = *next_unit;
    }

    if unit == "B" {
        format!("{} {}", size, unit)
    } else {
        format!("{value:.1} {unit}")
    }
}

async fn logo_svg() -> impl IntoResponse {
    (
        [
            (header::CONTENT_TYPE, "image/svg+xml"),
            (header::CACHE_CONTROL, "no-store"),
        ],
        logo::render_logo_svg(),
    )
}
