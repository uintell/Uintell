use std::{
    env,
    error::Error as StdError,
    fmt,
    fs::{self, File},
    io::{self, BufRead, BufReader, BufWriter, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
};

use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};

const WIKI_DUMP_ENV: &str = "UINTELL_WIKI_DUMP";
const WIKI_TITLE_INDEX_ENV: &str = "UINTELL_WIKI_TITLE_INDEX";
const WIKI_STREAM_INDEX_ENV: &str = "UINTELL_WIKI_STREAM_INDEX";

pub const DEFAULT_DUMP_FILE: &str = "enwiki-latest-pages-articles-multistream.xml.bz2";
pub const DEFAULT_TITLE_INDEX_FILE: &str = "enwiki-titles.txt";
pub const DEFAULT_STREAM_INDEX_FILE: &str = "enwiki-latest-pages-articles-multistream-index.txt.bz2";
pub const DEFAULT_SEARCH_LIMIT: usize = 12;
pub const DEFAULT_PREVIEW_BYTES: usize = 4_000;

#[derive(Debug, Clone)]
pub struct DumpInfo {
    pub dump_path: PathBuf,
    pub dump_exists: bool,
    pub dump_size_bytes: Option<u64>,
    pub title_index_path: PathBuf,
    pub title_index_exists: bool,
    pub title_index_temp_path: PathBuf,
    pub title_index_temp_exists: bool,
    pub title_index_temp_size_bytes: Option<u64>,
    pub stream_index_path: PathBuf,
    pub stream_index_exists: bool,
    pub stream_index_size_bytes: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct SearchHit {
    pub title: String,
    pub local_url: String,
    pub wikipedia_url: String,
}

#[derive(Debug, Clone, Copy)]
pub enum SearchSource {
    TitleIndex,
    PartialTitleIndex,
}

impl SearchSource {
    pub fn label(self) -> &'static str {
        match self {
            Self::TitleIndex => "title index",
            Self::PartialTitleIndex => "partial title index",
        }
    }
}

#[derive(Debug, Clone)]
pub struct SearchOutcome {
    pub hits: Vec<SearchHit>,
    pub source: SearchSource,
}

#[derive(Debug, Clone)]
pub struct ArticlePreview {
    pub title: String,
    pub redirect: Option<String>,
    pub preview: String,
    pub wikipedia_url: String,
}

#[derive(Debug, Clone)]
pub struct IndexBuildStats {
    pub titles_written: usize,
    pub path: PathBuf,
}

#[derive(Debug)]
pub enum Error {
    DumpMissing(PathBuf),
    TitleIndexMissing {
        final_path: PathBuf,
        temp_path: PathBuf,
    },
    CommandUnavailable(&'static str),
    Io(io::Error),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::DumpMissing(path) => {
                write!(f, "Wikipedia dump not found at {}", path.display())
            }
            Self::TitleIndexMissing {
                final_path,
                temp_path,
            } => {
                write!(
                    f,
                    "Wikipedia title index not found at {} and no in-progress index was found at {}",
                    final_path.display(),
                    temp_path.display()
                )
            }
            Self::CommandUnavailable(command) => {
                write!(f, "required command is not available: {command}")
            }
            Self::Io(err) => err.fmt(f),
        }
    }
}

impl StdError for Error {
    fn source(&self) -> Option<&(dyn StdError + 'static)> {
        match self {
            Self::Io(err) => Some(err),
            _ => None,
        }
    }
}

impl From<io::Error> for Error {
    fn from(value: io::Error) -> Self {
        Self::Io(value)
    }
}

pub fn dump_info() -> DumpInfo {
    let dump_path = dump_path();
    let title_index_path = title_index_path();
    let title_index_temp_path = temp_index_path(&title_index_path);
    let stream_index_path = stream_index_path();

    DumpInfo {
        dump_exists: dump_path.exists(),
        dump_size_bytes: fs::metadata(&dump_path).ok().map(|metadata| metadata.len()),
        title_index_exists: title_index_path.exists(),
        title_index_temp_exists: title_index_temp_path.exists(),
        title_index_temp_size_bytes: fs::metadata(&title_index_temp_path)
            .ok()
            .map(|metadata| metadata.len()),
        stream_index_exists: stream_index_path.exists(),
        stream_index_size_bytes: fs::metadata(&stream_index_path)
            .ok()
            .map(|metadata| metadata.len()),
        dump_path,
        title_index_path,
        title_index_temp_path,
        stream_index_path,
    }
}

pub fn search(query: &str, limit: usize) -> Result<SearchOutcome, Error> {
    let terms = search_terms(query);
    let info = dump_info();

    if !info.dump_exists {
        return Err(Error::DumpMissing(info.dump_path));
    }

    if terms.is_empty() {
        return Ok(SearchOutcome {
            hits: Vec::new(),
            source: if info.title_index_exists {
                SearchSource::TitleIndex
            } else {
                SearchSource::PartialTitleIndex
            },
        });
    }

    if info.title_index_exists {
        return Ok(SearchOutcome {
            hits: search_title_index(&info.title_index_path, &terms, limit)?,
            source: SearchSource::TitleIndex,
        });
    }

    if info.title_index_temp_exists {
        return Ok(SearchOutcome {
            hits: search_title_index(&info.title_index_temp_path, &terms, limit)?,
            source: SearchSource::PartialTitleIndex,
        });
    }

    Err(Error::TitleIndexMissing {
        final_path: info.title_index_path,
        temp_path: info.title_index_temp_path,
    })
}

pub fn load_article_preview(
    title: &str,
    preview_limit: usize,
) -> Result<Option<ArticlePreview>, Error> {
    let target = title.trim();
    let info = dump_info();

    if !info.dump_exists {
        return Err(Error::DumpMissing(info.dump_path));
    }

    if target.is_empty() {
        return Ok(None);
    }

    if info.stream_index_exists {
        if let Some(offset) = find_article_stream_offset(&info.stream_index_path, target)? {
            return with_dump_reader_from_offset(&info.dump_path, offset, |reader| {
                load_article_preview_from_reader(reader, target, preview_limit)
            });
        }

        return Ok(None);
    }

    with_bz_reader(&info.dump_path, |reader| {
        load_article_preview_from_reader(reader, target, preview_limit)
    })
}

pub fn build_title_index(limit: Option<usize>) -> Result<IndexBuildStats, Error> {
    let info = dump_info();

    if !info.dump_exists {
        return Err(Error::DumpMissing(info.dump_path));
    }

    if let Some(parent) = info.title_index_path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }

    let temp_path = temp_index_path(&info.title_index_path);
    let output = File::create(&temp_path)?;
    let mut writer = BufWriter::new(output);
    let mut titles_written = 0usize;

    with_bz_reader(&info.dump_path, |reader| {
        let mut line = String::new();
        let mut current_title: Option<String> = None;
        let mut indexed_current_page = false;

        loop {
            line.clear();
            if reader.read_line(&mut line)? == 0 {
                break;
            }

            let row = trim_line_end(&line);

            if row.contains("<page>") {
                current_title = None;
                indexed_current_page = false;
            }

            if let Some(title) = extract_tag(row, "title") {
                current_title = Some(title);
            }

            if indexed_current_page {
                continue;
            }

            if let Some(namespace) = extract_tag(row, "ns") {
                indexed_current_page = true;

                if namespace.trim() != "0" {
                    continue;
                }

                if let Some(title) = current_title.as_ref() {
                    writer.write_all(title.as_bytes())?;
                    writer.write_all(b"\n")?;
                    titles_written += 1;
                }

                if limit.is_some_and(|max| titles_written >= max) {
                    break;
                }
            }
        }

        writer.flush()?;
        Ok(())
    })?;

    drop(writer);
    fs::rename(&temp_path, &info.title_index_path)?;

    Ok(IndexBuildStats {
        titles_written,
        path: info.title_index_path,
    })
}

fn search_title_index(
    index_path: &Path,
    terms: &[String],
    limit: usize,
) -> Result<Vec<SearchHit>, Error> {
    let file = File::open(index_path)?;
    let mut reader = BufReader::new(file);
    let mut line = String::new();
    let mut hits = Vec::with_capacity(limit);

    loop {
        line.clear();
        if reader.read_line(&mut line)? == 0 {
            break;
        }

        let title = trim_line_end(&line).trim();
        if title.is_empty() || !title_matches(title, terms) {
            continue;
        }

        hits.push(make_search_hit(title));
        if hits.len() >= limit {
            break;
        }
    }

    Ok(hits)
}

fn find_article_stream_offset(index_path: &Path, target: &str) -> Result<Option<u64>, Error> {
    with_bz_reader(index_path, |reader| {
        find_article_stream_offset_in_reader(reader, target)
    })
}

fn find_article_stream_offset_in_reader<R: BufRead>(
    reader: &mut R,
    target: &str,
) -> Result<Option<u64>, Error> {
    let mut line = String::new();

    loop {
        line.clear();
        if reader.read_line(&mut line)? == 0 {
            break;
        }

        let row = trim_line_end(&line);
        let Some((offset, indexed_title)) = parse_stream_index_line(row) else {
            continue;
        };

        if indexed_title == target {
            return Ok(Some(offset));
        }
    }

    Ok(None)
}

fn load_article_preview_from_reader<R: BufRead>(
    reader: &mut R,
    target: &str,
    preview_limit: usize,
) -> Result<Option<ArticlePreview>, Error> {
    let mut line = String::new();
    let mut current_title: Option<String> = None;
    let mut target_page = false;
    let mut redirect_title: Option<String> = None;
    let mut preview = String::new();
    let mut in_text = false;

    loop {
        line.clear();
        if reader.read_line(&mut line)? == 0 {
            break;
        }

        let row = trim_line_end(&line);

        if row.contains("<page>") {
            current_title = None;
            target_page = false;
            redirect_title = None;
            preview.clear();
            in_text = false;
        }

        if let Some(found_title) = extract_tag(row, "title") {
            current_title = Some(found_title);
        }

        if let Some(found_ns) = extract_tag(row, "ns") {
            target_page = found_ns.trim() == "0" && current_title.as_deref() == Some(target);
        }

        if !target_page {
            continue;
        }

        if redirect_title.is_none() {
            redirect_title = extract_redirect_title(row);
        }

        if in_text {
            let finished = append_text_fragment(&mut preview, row, preview_limit, true);
            if finished || preview.len() >= preview_limit {
                return Ok(Some(build_article_preview(
                    current_title.as_deref(),
                    target,
                    redirect_title,
                    &preview,
                )));
            }
            continue;
        }

        if let Some(text_body) = extract_text_start(row) {
            in_text = !append_text_fragment(&mut preview, text_body, preview_limit, false);
            if !in_text || preview.len() >= preview_limit {
                return Ok(Some(build_article_preview(
                    current_title.as_deref(),
                    target,
                    redirect_title,
                    &preview,
                )));
            }
        }

        if row.contains("</page>") {
            return Ok(Some(build_article_preview(
                current_title.as_deref(),
                target,
                redirect_title,
                &preview,
            )));
        }
    }

    Ok(None)
}

fn build_article_preview(
    current_title: Option<&str>,
    requested_title: &str,
    redirect_title: Option<String>,
    preview: &str,
) -> ArticlePreview {
    let title = current_title.unwrap_or(requested_title).to_owned();

    ArticlePreview {
        wikipedia_url: wikipedia_url(&title),
        title,
        redirect: redirect_title,
        preview: tidy_preview(preview),
    }
}

fn with_bz_reader<T, F>(compressed_path: &Path, mut read: F) -> Result<T, Error>
where
    F: FnMut(&mut BufReader<std::process::ChildStdout>) -> Result<T, Error>,
{
    let mut command = Command::new("bzcat");
    command
        .arg(compressed_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(err) if err.kind() == io::ErrorKind::NotFound => {
            return Err(Error::CommandUnavailable("bzcat"));
        }
        Err(err) => return Err(Error::Io(err)),
    };

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| io::Error::other("failed to capture bzcat stdout"))?;
    let mut reader = BufReader::new(stdout);
    let result = read(&mut reader);

    match child.try_wait() {
        Ok(Some(_)) => {}
        Ok(None) => {
            let _ = child.kill();
            let _ = child.wait();
        }
        Err(_) => {
            let _ = child.kill();
        }
    }

    result
}

fn with_dump_reader_from_offset<T, F>(dump_path: &Path, offset: u64, mut read: F) -> Result<T, Error>
where
    F: FnMut(&mut BufReader<std::process::ChildStdout>) -> Result<T, Error>,
{
    let mut dump = File::open(dump_path)?;
    dump.seek(SeekFrom::Start(offset))?;

    let mut command = Command::new("bzip2");
    command
        .arg("-dc")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(err) if err.kind() == io::ErrorKind::NotFound => {
            return Err(Error::CommandUnavailable("bzip2"));
        }
        Err(err) => return Err(Error::Io(err)),
    };

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| io::Error::other("failed to capture bzip2 stdin"))?;
    let writer = thread::spawn(move || io::copy(&mut dump, &mut stdin));

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| io::Error::other("failed to capture bzip2 stdout"))?;
    let mut reader = BufReader::new(stdout);
    let result = read(&mut reader);
    drop(reader);

    match child.try_wait() {
        Ok(Some(_)) => {}
        Ok(None) => {
            let _ = child.kill();
            let _ = child.wait();
        }
        Err(_) => {
            let _ = child.kill();
        }
    }

    match writer.join() {
        Ok(Ok(_)) => {}
        Ok(Err(err)) if err.kind() == io::ErrorKind::BrokenPipe => {}
        Ok(Err(err)) => return Err(Error::Io(err)),
        Err(_) => {
            return Err(Error::Io(io::Error::other(
                "stream copy thread panicked during article extraction",
            )));
        }
    }

    result
}

fn search_terms(query: &str) -> Vec<String> {
    query
        .split_whitespace()
        .map(|term| term.trim().to_lowercase())
        .filter(|term| !term.is_empty())
        .collect()
}

fn title_matches(title: &str, terms: &[String]) -> bool {
    let haystack = title.to_lowercase();
    terms.iter().all(|term| haystack.contains(term))
}

fn make_search_hit(title: &str) -> SearchHit {
    SearchHit {
        title: title.to_owned(),
        local_url: format!("/wiki/article?title={}", encode_component(title)),
        wikipedia_url: wikipedia_url(title),
    }
}

pub fn search_url(query: &str) -> String {
    format!("/search?q={}", encode_component(query))
}

pub fn article_path(title: &str) -> String {
    format!("/wiki/article?title={}", encode_component(title))
}

pub fn wikipedia_article_url(title: &str) -> String {
    wikipedia_url(title)
}

fn wikipedia_url(title: &str) -> String {
    let article = title.replace(' ', "_");
    format!(
        "https://en.wikipedia.org/wiki/{}",
        encode_component(&article)
    )
}

fn encode_component(value: &str) -> String {
    utf8_percent_encode(value, NON_ALPHANUMERIC).to_string()
}

fn parse_stream_index_line(line: &str) -> Option<(u64, &str)> {
    let mut parts = line.splitn(3, ':');
    let offset = parts.next()?.parse().ok()?;
    let _page_id = parts.next()?;
    let title = parts.next()?;
    Some((offset, title))
}

fn extract_tag(line: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let start = line.find(&open)? + open.len();
    let end = line[start..].find(&close)? + start;
    Some(decode_xml_entities(&line[start..end]))
}

fn extract_redirect_title(line: &str) -> Option<String> {
    let start = line.find("<redirect ")?;
    extract_attr(&line[start..], "title").map(decode_xml_entities)
}

fn extract_attr<'a>(line: &'a str, attr: &str) -> Option<&'a str> {
    let needle = format!(r#"{attr}=""#);
    let start = line.find(&needle)? + needle.len();
    let end = line[start..].find('"')? + start;
    Some(&line[start..end])
}

fn extract_text_start(line: &str) -> Option<&str> {
    let start = line.find("<text")?;
    let body_start = line[start..].find('>')? + start + 1;
    Some(&line[body_start..])
}

fn append_text_fragment(
    target: &mut String,
    fragment: &str,
    limit: usize,
    continued: bool,
) -> bool {
    let (body, closed) = if continued {
        match fragment.find("</text>") {
            Some(end) => (&fragment[..end], true),
            None => (fragment, false),
        }
    } else {
        match fragment.find("</text>") {
            Some(end) => (&fragment[..end], true),
            None => (fragment, false),
        }
    };

    append_limited(target, &decode_xml_entities(body), limit);

    if !closed && target.len() < limit {
        append_limited(target, "\n", limit);
    }

    closed || target.len() >= limit
}

fn append_limited(target: &mut String, fragment: &str, limit: usize) {
    if target.len() >= limit || fragment.is_empty() {
        return;
    }

    let remaining = limit - target.len();
    if fragment.len() <= remaining {
        target.push_str(fragment);
        return;
    }

    let mut cut = remaining;
    while cut > 0 && !fragment.is_char_boundary(cut) {
        cut -= 1;
    }

    target.push_str(&fragment[..cut]);
}

fn tidy_preview(preview: &str) -> String {
    preview.trim().to_owned()
}

fn decode_xml_entities(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

fn trim_line_end(line: &str) -> &str {
    line.trim_end_matches(['\r', '\n'])
}

fn dump_path() -> PathBuf {
    env::var(WIKI_DUMP_ENV)
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(DEFAULT_DUMP_FILE))
}

fn title_index_path() -> PathBuf {
    env::var(WIKI_TITLE_INDEX_ENV)
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(DEFAULT_TITLE_INDEX_FILE))
}

fn stream_index_path() -> PathBuf {
    env::var(WIKI_STREAM_INDEX_ENV)
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(DEFAULT_STREAM_INDEX_FILE))
}

fn temp_index_path(final_path: &Path) -> PathBuf {
    let file_name = final_path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| format!("{name}.tmp"))
        .unwrap_or_else(|| String::from("enwiki-titles.txt.tmp"));

    final_path.with_file_name(file_name)
}

#[cfg(test)]
mod tests {
    use super::{
        append_limited, decode_xml_entities, encode_component, extract_redirect_title, extract_tag,
        extract_text_start, find_article_stream_offset_in_reader, load_article_preview_from_reader,
        parse_stream_index_line, title_matches,
    };
    use std::io::Cursor;

    #[test]
    fn extracts_basic_tags() {
        assert_eq!(
            extract_tag("    <title>AT&amp;T</title>", "title"),
            Some(String::from("AT&T"))
        );
        assert_eq!(extract_tag("<ns>0</ns>", "ns"), Some(String::from("0")));
    }

    #[test]
    fn extracts_redirect_title() {
        assert_eq!(
            extract_redirect_title(r#"<redirect title="Computer accessibility" />"#),
            Some(String::from("Computer accessibility"))
        );
    }

    #[test]
    fn extracts_text_payload_start() {
        assert_eq!(
            extract_text_start(r#"<text bytes="9">Anarchism</text>"#),
            Some("Anarchism</text>")
        );
    }

    #[test]
    fn matches_all_terms_in_title() {
        assert!(title_matches(
            "New York City",
            &[String::from("new"), String::from("city")]
        ));
        assert!(!title_matches(
            "New York City",
            &[String::from("new"), String::from("paris")]
        ));
    }

    #[test]
    fn encodes_urls_and_limits_preview() {
        assert_eq!(encode_component("A/B test"), "A%2FB%20test");

        let mut preview = String::new();
        append_limited(&mut preview, "abcdef", 4);
        assert_eq!(preview, "abcd");
    }

    #[test]
    fn decodes_entities() {
        assert_eq!(
            decode_xml_entities("&lt;tag&gt;Tom &amp; Jerry&lt;/tag&gt;"),
            "<tag>Tom & Jerry</tag>"
        );
    }

    #[test]
    fn parses_multistream_index_lines() {
        assert_eq!(
            parse_stream_index_line("565:12:Anarchism"),
            Some((565, "Anarchism"))
        );
        assert_eq!(
            parse_stream_index_line("123:456:Help:IPA/English"),
            Some((123, "Help:IPA/English"))
        );
    }

    #[test]
    fn finds_stream_offset_for_exact_title() {
        let mut reader = Cursor::new("565:10:AccessibleComputing\n565:12:Anarchism\n");
        assert_eq!(
            find_article_stream_offset_in_reader(&mut reader, "Anarchism").unwrap(),
            Some(565)
        );
    }

    #[test]
    fn extracts_preview_from_page_reader() {
        let xml = concat!(
            "<page>\n",
            "<title>Other page</title>\n",
            "<ns>0</ns>\n",
            "<revision>\n",
            "<text xml:space=\"preserve\">Skip me</text>\n",
            "</revision>\n",
            "</page>\n",
            "<page>\n",
            "<title>Anarchism</title>\n",
            "<ns>0</ns>\n",
            "<redirect title=\"Libertarian socialism\" />\n",
            "<revision>\n",
            "<text xml:space=\"preserve\">Tom &amp; Jerry\nSecond line</text>\n",
            "</revision>\n",
            "</page>\n"
        );
        let mut reader = Cursor::new(xml);
        let preview = load_article_preview_from_reader(&mut reader, "Anarchism", 128)
            .unwrap()
            .expect("preview should be present");

        assert_eq!(preview.title, "Anarchism");
        assert_eq!(preview.redirect.as_deref(), Some("Libertarian socialism"));
        assert!(preview.preview.contains("Tom & Jerry"));
    }
}
