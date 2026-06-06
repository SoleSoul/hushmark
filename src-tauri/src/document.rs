use std::{
    collections::{HashMap, HashSet, VecDeque},
    ffi::OsString,
    fs,
    io::ErrorKind,
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use ammonia::Builder;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use percent_encoding::percent_decode_str;
use pulldown_cmark::{html, Alignment, CowStr, Event, Options, Parser, Tag, TagEnd};
use serde::Serialize;

use crate::identity::DISPLAY_NAME;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedDocument {
    pub path: Option<String>,
    pub navigation_root: Option<String>,
    pub file_name: Option<String>,
    pub html: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkedDocument {
    pub document: LoadedDocument,
    pub fragment: Option<String>,
}

impl LoadedDocument {
    fn empty() -> Self {
        Self {
            path: None,
            navigation_root: None,
            file_name: None,
            html: None,
            error: None,
        }
    }

    fn loaded(path: &Path, navigation_root: Option<&Path>, html: String) -> Self {
        Self {
            path: Some(path.display().to_string()),
            navigation_root: navigation_root.map(path_to_string),
            file_name: Some(file_name(path)),
            html: Some(html),
            error: None,
        }
    }

    fn failed(path: &Path, navigation_root: Option<&Path>, error: String) -> Self {
        Self {
            path: Some(path.display().to_string()),
            navigation_root: navigation_root.map(path_to_string),
            file_name: Some(file_name(path)),
            html: None,
            error: Some(error),
        }
    }
}

pub fn load_initial_document_from_arg(arg: Option<OsString>) -> LoadedDocument {
    match arg {
        Some(path) => load_markdown_file(PathBuf::from(path)),
        None => LoadedDocument::empty(),
    }
}

pub fn load_markdown_file(path: PathBuf) -> LoadedDocument {
    let navigation_root = navigation_root_for_document_path(&path);
    load_markdown_file_with_navigation_root(path, navigation_root)
}

fn load_markdown_file_with_navigation_root(
    path: PathBuf,
    navigation_root: Option<PathBuf>,
) -> LoadedDocument {
    match fs::read_to_string(&path) {
        Ok(markdown) => {
            let html = render_markdown_file_to_safe_html(&markdown, &path);
            LoadedDocument::loaded(&path, navigation_root.as_deref(), html)
        }
        Err(error) => LoadedDocument::failed(
            &path,
            navigation_root.as_deref(),
            read_error_message(&path, error),
        ),
    }
}

pub fn load_dropped_markdown_file(path: PathBuf) -> LoadedDocument {
    if !is_markdown_path(&path) {
        return LoadedDocument::failed(
            &path,
            navigation_root_for_document_path(&path).as_deref(),
            format!(
                "Only .md and .markdown files can be opened here. {} was not opened.",
                path.display()
            ),
        );
    }

    load_markdown_file(path)
}

pub fn load_linked_markdown_file(
    current_path: PathBuf,
    navigation_root: PathBuf,
    href: String,
) -> LinkedDocument {
    match resolve_linked_markdown_path(&current_path, &navigation_root, &href) {
        Ok(resolved) => LinkedDocument {
            document: load_markdown_file_with_navigation_root(
                resolved.path,
                Some(resolved.navigation_root),
            ),
            fragment: resolved.fragment,
        },
        Err(error) => LinkedDocument {
            document: LoadedDocument::failed(&current_path, Some(&navigation_root), error),
            fragment: None,
        },
    }
}

pub fn title_for(document: &LoadedDocument) -> String {
    match (&document.file_name, &document.error) {
        (Some(file_name), Some(_)) => format!("Error: {file_name} - {DISPLAY_NAME}"),
        (Some(file_name), None) => format!("{file_name} - {DISPLAY_NAME}"),
        (None, Some(_)) => format!("Error - {DISPLAY_NAME}"),
        (None, None) => DISPLAY_NAME.to_string(),
    }
}

fn render_markdown_file_to_safe_html(markdown: &str, document_path: &Path) -> String {
    render_markdown_with_document_path(markdown, Some(document_path))
}

#[cfg(test)]
fn render_markdown_to_safe_html(markdown: &str) -> String {
    render_markdown_with_document_path(markdown, None)
}

fn render_markdown_with_document_path(markdown: &str, document_path: Option<&Path>) -> String {
    let mut local_images = LocalImageResolver::new(document_path);
    let mut table_alignments = TableAlignmentRewriter::new();
    let mut heading_ids = HeadingIdRewriter::new(collect_heading_ids(markdown));
    let mut rendered = String::new();

    {
        let parser = Parser::new_ext(markdown, markdown_options()).map(|event| {
            let event = local_images.rewrite_event(event);
            let event = table_alignments.rewrite_event(event);
            heading_ids.rewrite_event(event)
        });
        html::push_html(&mut rendered, parser);
    }

    let allowed_table_classes = table_alignments.allowed_classes();
    let allowed_heading_ids = heading_ids.allowed_ids();
    let safe_html = sanitize_rendered_html(&rendered, &allowed_table_classes, &allowed_heading_ids);
    let safe_html = local_images.rewrite_sanitized_html_image_sources(safe_html);
    let safe_html = heading_ids.apply_replacements(safe_html);
    let safe_html = table_alignments.apply_replacements(safe_html);
    local_images.apply_replacements(safe_html)
}

fn sanitize_rendered_html(
    rendered: &str,
    allowed_table_classes: &[String],
    allowed_heading_ids: &[String],
) -> String {
    let allowed_table_classes: Vec<&str> =
        allowed_table_classes.iter().map(String::as_str).collect();
    let allowed_heading_ids: Vec<&str> = allowed_heading_ids.iter().map(String::as_str).collect();
    let mut builder = Builder::default();

    builder.add_allowed_classes("th", &allowed_table_classes);
    builder.add_allowed_classes("td", &allowed_table_classes);

    for tag in ["h1", "h2", "h3", "h4", "h5", "h6"] {
        builder.add_tag_attribute_values(tag, "id", &allowed_heading_ids);
    }

    builder.clean(rendered).to_string()
}

fn markdown_options() -> Options {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options
}

fn collect_heading_ids(markdown: &str) -> Vec<String> {
    let mut slugs = HeadingSlugger::new();
    let mut heading_text = String::new();
    let mut in_heading = false;
    let mut heading_ids = Vec::new();

    for event in Parser::new_ext(markdown, markdown_options()) {
        match event {
            Event::Start(Tag::Heading { .. }) => {
                in_heading = true;
                heading_text.clear();
            }
            Event::End(TagEnd::Heading(_)) if in_heading => {
                heading_ids.push(slugs.unique_slug(&heading_text));
                heading_text.clear();
                in_heading = false;
            }
            Event::Text(text)
            | Event::Code(text)
            | Event::InlineMath(text)
            | Event::DisplayMath(text)
                if in_heading =>
            {
                heading_text.push_str(&text);
            }
            Event::SoftBreak | Event::HardBreak if in_heading => {
                heading_text.push(' ');
            }
            _ => {}
        }
    }

    heading_ids
}

struct HeadingSlugger {
    next_suffix: HashMap<String, usize>,
    used: HashSet<String>,
}

impl HeadingSlugger {
    fn new() -> Self {
        Self {
            next_suffix: HashMap::new(),
            used: HashSet::new(),
        }
    }

    fn unique_slug(&mut self, text: &str) -> String {
        let base = slugify_heading(text);

        if self.used.insert(base.clone()) {
            self.next_suffix.entry(base.clone()).or_insert(1);
            return base;
        }

        let mut suffix = self.next_suffix.get(&base).copied().unwrap_or(1);
        loop {
            let candidate = format!("{base}-{suffix}");
            suffix += 1;

            if self.used.insert(candidate.clone()) {
                self.next_suffix.insert(base, suffix);
                return candidate;
            }
        }
    }
}

fn slugify_heading(text: &str) -> String {
    let mut slug = String::new();
    let mut previous_was_separator = false;

    for character in text.trim().chars().flat_map(char::to_lowercase) {
        if character.is_alphanumeric() {
            slug.push(character);
            previous_was_separator = false;
        } else if !slug.is_empty() && !previous_was_separator {
            slug.push('-');
            previous_was_separator = true;
        }
    }

    while slug.ends_with('-') {
        slug.pop();
    }

    if slug.is_empty() {
        "heading".to_string()
    } else {
        slug
    }
}

struct HeadingIdRewriter {
    ids: VecDeque<String>,
    placeholder_prefix: String,
    replacements: Vec<(String, String)>,
}

impl HeadingIdRewriter {
    fn new(ids: Vec<String>) -> Self {
        Self {
            ids: ids.into(),
            placeholder_prefix: heading_id_placeholder_prefix(),
            replacements: Vec::new(),
        }
    }

    fn rewrite_event<'a>(&mut self, event: Event<'a>) -> Event<'a> {
        match event {
            Event::Start(Tag::Heading {
                level,
                id: _,
                classes,
                attrs,
            }) => {
                let id = self.ids.pop_front().map(|public_id| {
                    let placeholder =
                        format!("{}-{}", self.placeholder_prefix, self.replacements.len());
                    self.replacements.push((placeholder.clone(), public_id));
                    CowStr::from(placeholder)
                });

                Event::Start(Tag::Heading {
                    level,
                    id,
                    classes,
                    attrs,
                })
            }
            _ => event,
        }
    }

    fn allowed_ids(&self) -> Vec<String> {
        self.replacements
            .iter()
            .map(|(placeholder, _)| placeholder.clone())
            .collect()
    }

    fn apply_replacements(&self, mut safe_html: String) -> String {
        for (placeholder, public_id) in self.replacements.iter().rev() {
            safe_html = safe_html.replace(placeholder, public_id);
        }

        safe_html
    }
}

fn heading_id_placeholder_prefix() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();

    format!("hushmark-heading-token-{nanos}-{}", std::process::id())
}

struct TableAlignmentRewriter {
    alignments: Vec<Alignment>,
    table_part: TablePart,
    cell_index: usize,
    placeholder_prefix: String,
    replacements: Vec<(String, &'static str)>,
}

impl TableAlignmentRewriter {
    fn new() -> Self {
        Self {
            alignments: Vec::new(),
            table_part: TablePart::Body,
            cell_index: 0,
            placeholder_prefix: table_alignment_placeholder_prefix(),
            replacements: Vec::new(),
        }
    }

    fn rewrite_event<'a>(&mut self, event: Event<'a>) -> Event<'a> {
        match event {
            Event::Start(Tag::Table(alignments)) => {
                self.alignments = alignments;
                self.table_part = TablePart::Head;
                self.cell_index = 0;
                Event::Start(Tag::Table(Vec::new()))
            }
            Event::Start(Tag::TableHead) => {
                self.table_part = TablePart::Head;
                self.cell_index = 0;
                Event::Start(Tag::TableHead)
            }
            Event::End(TagEnd::TableHead) => {
                self.table_part = TablePart::Body;
                self.cell_index = 0;
                Event::End(TagEnd::TableHead)
            }
            Event::Start(Tag::TableRow) => {
                self.cell_index = 0;
                Event::Start(Tag::TableRow)
            }
            Event::Start(Tag::TableCell) => Event::Html(CowStr::from(self.table_cell_start_tag())),
            Event::End(TagEnd::TableCell) => {
                let tag = self.table_part.cell_tag();
                self.cell_index += 1;
                Event::Html(CowStr::from(format!("</{tag}>")))
            }
            Event::End(TagEnd::Table) => {
                self.alignments.clear();
                self.table_part = TablePart::Body;
                self.cell_index = 0;
                Event::End(TagEnd::Table)
            }
            _ => event,
        }
    }

    fn table_cell_start_tag(&mut self) -> String {
        let tag = self.table_part.cell_tag();

        match self
            .alignments
            .get(self.cell_index)
            .and_then(markdown_alignment_class)
        {
            Some(public_class) => {
                let placeholder =
                    format!("{}-{}", self.placeholder_prefix, self.replacements.len());
                self.replacements.push((placeholder.clone(), public_class));
                format!("<{tag} class=\"{placeholder}\">")
            }
            None => format!("<{tag}>"),
        }
    }

    fn allowed_classes(&self) -> Vec<String> {
        self.replacements
            .iter()
            .map(|(placeholder, _)| placeholder.clone())
            .collect()
    }

    fn apply_replacements(&self, mut safe_html: String) -> String {
        for (placeholder, public_class) in self.replacements.iter().rev() {
            safe_html = safe_html.replace(placeholder, public_class);
        }

        safe_html
    }
}

#[derive(Clone, Copy)]
enum TablePart {
    Head,
    Body,
}

impl TablePart {
    fn cell_tag(self) -> &'static str {
        match self {
            Self::Head => "th",
            Self::Body => "td",
        }
    }
}

fn markdown_alignment_class(alignment: &Alignment) -> Option<&'static str> {
    match alignment {
        Alignment::Left => Some("hushmark-align-left"),
        Alignment::Center => Some("hushmark-align-center"),
        Alignment::Right => Some("hushmark-align-right"),
        Alignment::None => None,
    }
}

fn table_alignment_placeholder_prefix() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();

    format!("hushmark-align-token-{nanos}-{}", std::process::id())
}

struct LocalImageResolver {
    base_dir: Option<PathBuf>,
    placeholder_prefix: String,
    replacements: Vec<(String, String)>,
}

impl LocalImageResolver {
    fn new(document_path: Option<&Path>) -> Self {
        Self {
            base_dir: document_path.and_then(canonical_document_dir),
            placeholder_prefix: local_image_placeholder_prefix(),
            replacements: Vec::new(),
        }
    }

    fn rewrite_event<'a>(&mut self, event: Event<'a>) -> Event<'a> {
        match event {
            Event::Start(Tag::Image {
                link_type,
                dest_url,
                title,
                id,
            }) => {
                let dest_url = self
                    .rewrite_image_destination(&dest_url)
                    .map(CowStr::from)
                    .unwrap_or(dest_url);

                Event::Start(Tag::Image {
                    link_type,
                    dest_url,
                    title,
                    id,
                })
            }
            _ => event,
        }
    }

    fn rewrite_image_destination(&mut self, src: &str) -> Option<String> {
        match local_image_data_uri(self.base_dir.as_deref(), src) {
            ImageResolution::Resolved(data_uri) => {
                let placeholder =
                    format!("{}/{}", self.placeholder_prefix, self.replacements.len());
                self.replacements.push((placeholder.clone(), data_uri));
                Some(placeholder)
            }
            ImageResolution::RejectedLocal => Some(String::new()),
            ImageResolution::NotLocal => None,
        }
    }

    fn apply_replacements(&self, mut safe_html: String) -> String {
        for (placeholder, data_uri) in self.replacements.iter().rev() {
            safe_html = safe_html.replace(
                &format!("src=\"{placeholder}\""),
                &format!("src=\"{data_uri}\""),
            );
        }

        safe_html
    }

    fn rewrite_sanitized_html_image_sources(&mut self, safe_html: String) -> String {
        let mut rewritten = String::with_capacity(safe_html.len());
        let mut remaining = safe_html.as_str();

        while let Some(img_start) = remaining.find("<img") {
            let (before, after_start) = remaining.split_at(img_start);
            rewritten.push_str(before);

            let Some(img_end) = after_start.find('>') else {
                rewritten.push_str(after_start);
                return rewritten;
            };

            let (tag, after_tag) = after_start.split_at(img_end + 1);
            rewritten.push_str(&self.rewrite_sanitized_img_tag(tag));
            remaining = after_tag;
        }

        rewritten.push_str(remaining);
        rewritten
    }

    fn rewrite_sanitized_img_tag(&mut self, tag: &str) -> String {
        let Some(src_start) = tag.find("src=\"") else {
            return tag.to_string();
        };

        let value_start = src_start + "src=\"".len();
        let Some(value_end_offset) = tag[value_start..].find('"') else {
            return tag.to_string();
        };
        let value_end = value_start + value_end_offset;
        let src = &tag[value_start..value_end];

        let Some(rewritten_src) = self.rewrite_image_destination(src) else {
            return tag.to_string();
        };

        format!(
            "{}{}{}",
            &tag[..value_start],
            rewritten_src,
            &tag[value_end..]
        )
    }
}

fn local_image_placeholder_prefix() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();

    format!(
        "https://hushmark.local/__local-image/{nanos}-{}",
        std::process::id()
    )
}

enum ImageResolution {
    Resolved(String),
    RejectedLocal,
    NotLocal,
}

fn local_image_data_uri(base_dir: Option<&Path>, src: &str) -> ImageResolution {
    if has_file_scheme(src) || looks_like_windows_absolute_path(src) {
        return ImageResolution::RejectedLocal;
    }

    if has_url_scheme(src) {
        return ImageResolution::NotLocal;
    }

    let Some(base_dir) = base_dir else {
        return ImageResolution::NotLocal;
    };

    let Ok(decoded_src) = percent_decode_str(src).decode_utf8() else {
        return ImageResolution::RejectedLocal;
    };

    let relative_path = Path::new(decoded_src.as_ref());
    if !is_safe_relative_image_path(relative_path) {
        return ImageResolution::RejectedLocal;
    }

    let Some(mime_type) = image_mime_type(relative_path) else {
        return ImageResolution::RejectedLocal;
    };

    let candidate = base_dir.join(relative_path);
    let Ok(candidate) = fs::canonicalize(candidate) else {
        return ImageResolution::RejectedLocal;
    };

    if !candidate.starts_with(base_dir) || !candidate.is_file() {
        return ImageResolution::RejectedLocal;
    }

    let Ok(bytes) = fs::read(candidate) else {
        return ImageResolution::RejectedLocal;
    };

    ImageResolution::Resolved(format!(
        "data:{mime_type};base64,{}",
        BASE64_STANDARD.encode(bytes)
    ))
}

fn has_file_scheme(src: &str) -> bool {
    src.get(..5)
        .is_some_and(|scheme| scheme.eq_ignore_ascii_case("file:"))
}

fn looks_like_windows_absolute_path(src: &str) -> bool {
    let mut chars = src.chars();
    matches!(chars.next(), Some(character) if character.is_ascii_alphabetic())
        && matches!(chars.next(), Some(':'))
        && matches!(chars.next(), Some('\\' | '/'))
}

fn canonical_document_dir(document_path: &Path) -> Option<PathBuf> {
    fs::canonicalize(document_path)
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
}

fn navigation_root_for_document_path(document_path: &Path) -> Option<PathBuf> {
    canonical_document_dir(document_path)
}

struct ResolvedLinkedMarkdownPath {
    path: PathBuf,
    navigation_root: PathBuf,
    fragment: Option<String>,
}

fn resolve_linked_markdown_path(
    current_path: &Path,
    navigation_root: &Path,
    href: &str,
) -> Result<ResolvedLinkedMarkdownPath, String> {
    let parsed = parse_relative_markdown_link(href)?;
    let navigation_root = fs::canonicalize(navigation_root).map_err(|error| {
        format!(
            "Hushmark could not resolve the Markdown navigation root {}. {error}",
            navigation_root.display()
        )
    })?;

    if !navigation_root.is_dir() {
        return Err(format!(
            "Hushmark could not use {} as a Markdown navigation root.",
            navigation_root.display()
        ));
    }

    let current_path = fs::canonicalize(current_path).map_err(|error| {
        format!(
            "Hushmark could not resolve the current Markdown document {}. {error}",
            current_path.display()
        )
    })?;

    if !current_path.is_file() || !current_path.starts_with(&navigation_root) {
        return Err("Hushmark could not open that link from this document.".to_string());
    }

    let Some(current_dir) = current_path.parent() else {
        return Err("Hushmark could not determine the current document folder.".to_string());
    };

    let target_path = current_dir.join(&parsed.path);
    let target_path = fs::canonicalize(&target_path).map_err(|error| {
        format!(
            "Hushmark could not resolve linked Markdown file {}. {error}",
            target_path.display()
        )
    })?;

    if !target_path.starts_with(&navigation_root) {
        return Err(
            "Hushmark blocked a linked Markdown file outside this document folder.".to_string(),
        );
    }

    if !target_path.is_file() || !is_markdown_path(&target_path) {
        return Err(format!(
            "Only .md and .markdown links can be opened in Hushmark. {} was not opened.",
            target_path.display()
        ));
    }

    Ok(ResolvedLinkedMarkdownPath {
        path: target_path,
        navigation_root,
        fragment: parsed.fragment,
    })
}

struct ParsedRelativeMarkdownLink {
    path: PathBuf,
    fragment: Option<String>,
}

fn parse_relative_markdown_link(href: &str) -> Result<ParsedRelativeMarkdownLink, String> {
    let href = href.trim();
    if href.is_empty() || href.chars().any(char::is_control) {
        return Err("Hushmark could not open that Markdown link.".to_string());
    }

    if has_url_scheme(href) {
        return Err("Hushmark does not open that link as a local Markdown document.".to_string());
    }

    let (path_part, fragment) = href.split_once('#').unwrap_or((href, ""));
    if path_part.is_empty() {
        return Err("Hushmark could not open an empty Markdown link.".to_string());
    }

    let decoded_path = percent_decode_str(path_part)
        .decode_utf8()
        .map_err(|_| "Hushmark could not decode that Markdown link.".to_string())?;

    if decoded_path
        .chars()
        .any(|character| character.is_control() || character == '\0')
    {
        return Err("Hushmark could not open that Markdown link.".to_string());
    }

    let path = Path::new(decoded_path.as_ref());
    if !is_safe_relative_document_link_path(path) {
        return Err("Hushmark only opens relative Markdown document links.".to_string());
    }

    if !is_markdown_path(path) {
        return Err("Hushmark only opens .md and .markdown document links.".to_string());
    }

    Ok(ParsedRelativeMarkdownLink {
        path: path.to_path_buf(),
        fragment: (!fragment.is_empty()).then(|| fragment.to_string()),
    })
}

fn is_safe_relative_document_link_path(path: &Path) -> bool {
    let mut has_normal_component = false;

    for component in path.components() {
        match component {
            Component::Normal(_) => has_normal_component = true,
            Component::CurDir | Component::ParentDir => {}
            Component::RootDir | Component::Prefix(_) => return false,
        }
    }

    has_normal_component
}

fn path_to_string(path: &Path) -> String {
    path.display().to_string()
}

fn has_url_scheme(src: &str) -> bool {
    let Some(separator) = src.find(':') else {
        return false;
    };

    let scheme = &src[..separator];
    !scheme.is_empty()
        && scheme.starts_with(|character: char| character.is_ascii_alphabetic())
        && scheme.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '+' | '-' | '.')
        })
}

fn is_safe_relative_image_path(path: &Path) -> bool {
    let mut has_normal_component = false;

    for component in path.components() {
        match component {
            Component::Normal(_) => has_normal_component = true,
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return false,
        }
    }

    has_normal_component
}

fn image_mime_type(path: &Path) -> Option<&'static str> {
    let extension = path.extension()?.to_str()?;

    if extension.eq_ignore_ascii_case("png") {
        Some("image/png")
    } else if extension.eq_ignore_ascii_case("jpg") || extension.eq_ignore_ascii_case("jpeg") {
        Some("image/jpeg")
    } else if extension.eq_ignore_ascii_case("gif") {
        Some("image/gif")
    } else if extension.eq_ignore_ascii_case("svg") {
        Some("image/svg+xml")
    } else if extension.eq_ignore_ascii_case("webp") {
        Some("image/webp")
    } else {
        None
    }
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(str::to_owned)
        .unwrap_or_else(|| path.display().to_string())
}

fn read_error_message(path: &Path, error: std::io::Error) -> String {
    let path = path.display();

    match error.kind() {
        ErrorKind::NotFound => {
            format!("Hushmark could not find {path}. The file may have moved or been deleted.")
        }
        ErrorKind::PermissionDenied => {
            format!("Hushmark does not have permission to read {path}.")
        }
        ErrorKind::InvalidData => {
            format!("Hushmark could not read {path} as UTF-8 Markdown.")
        }
        _ => format!("Hushmark could not read {path}. {error}"),
    }
}

fn is_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            extension.eq_ignore_ascii_case("md") || extension.eq_ignore_ascii_case("markdown")
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use std::{env, fs};

    use pulldown_cmark::Options;

    use super::{
        load_dropped_markdown_file, load_initial_document_from_arg, load_linked_markdown_file,
        load_markdown_file, markdown_options, render_markdown_to_safe_html, title_for,
        LoadedDocument,
    };

    #[test]
    fn markdown_options_define_current_support_baseline() {
        let options = markdown_options();

        assert!(options.contains(Options::ENABLE_TABLES));
        assert!(options.contains(Options::ENABLE_STRIKETHROUGH));
        assert!(!options.contains(Options::ENABLE_TASKLISTS));
        assert!(!options.contains(Options::ENABLE_FOOTNOTES));
        assert!(!options.contains(Options::ENABLE_HEADING_ATTRIBUTES));
        assert!(!options.contains(Options::ENABLE_GFM));
    }

    #[test]
    fn enabled_markdown_extensions_render_as_html() {
        let html = render_markdown_to_safe_html(
            "| Feature | State |\n| --- | --- |\n| Tables | Enabled |\n\n~~removed~~",
        );

        assert!(html.contains("<table>"));
        assert!(html.contains("<th>Feature</th>"));
        assert!(html.contains("<td>Enabled</td>"));
        assert!(html.contains("<del>removed</del>"));
    }

    #[test]
    fn markdown_table_alignment_renders_as_controlled_classes() {
        let html = render_markdown_to_safe_html(
            "| Left | Center | Right |\n| :--- | :---: | ---: |\n| apple | banana | 123 |",
        );

        assert!(html.contains("<th class=\"hushmark-align-left\">Left</th>"));
        assert!(html.contains("<th class=\"hushmark-align-center\">Center</th>"));
        assert!(html.contains("<th class=\"hushmark-align-right\">Right</th>"));
        assert!(html.contains("<td class=\"hushmark-align-left\">apple</td>"));
        assert!(html.contains("<td class=\"hushmark-align-center\">banana</td>"));
        assert!(html.contains("<td class=\"hushmark-align-right\">123</td>"));
        assert!(!html.contains("style="));
        assert!(!html.contains("hushmark-align-token"));
    }

    #[test]
    fn generates_heading_ids_from_markdown_heading_text() {
        let html = render_markdown_to_safe_html(
            "# Introduction\n\n## My Section\n\n### Install / Update\n\n#### Four\n\n##### Five\n\n###### Six",
        );

        assert!(html.contains("<h1 id=\"introduction\">Introduction</h1>"));
        assert!(html.contains("<h2 id=\"my-section\">My Section</h2>"));
        assert!(html.contains("<h3 id=\"install-update\">Install / Update</h3>"));
        assert!(html.contains("<h4 id=\"four\">Four</h4>"));
        assert!(html.contains("<h5 id=\"five\">Five</h5>"));
        assert!(html.contains("<h6 id=\"six\">Six</h6>"));
        assert!(!html.contains("hushmark-heading-token"));
    }

    #[test]
    fn duplicate_heading_ids_get_stable_suffixes() {
        let html = render_markdown_to_safe_html("# Intro\n\n## Intro\n\n### Intro");

        assert!(html.contains("<h1 id=\"intro\">Intro</h1>"));
        assert!(html.contains("<h2 id=\"intro-1\">Intro</h2>"));
        assert!(html.contains("<h3 id=\"intro-2\">Intro</h3>"));
    }

    #[test]
    fn punctuation_and_empty_heading_slugs_are_predictable() {
        let html = render_markdown_to_safe_html("# !!!\n\n## Install / Update\n\n### ...");

        assert!(html.contains("<h1 id=\"heading\">!!!</h1>"));
        assert!(html.contains("<h2 id=\"install-update\">Install / Update</h2>"));
        assert!(html.contains("<h3 id=\"heading-1\">...</h3>"));
    }

    #[test]
    fn unicode_heading_ids_are_preserved() {
        let html = render_markdown_to_safe_html("# שלום עולם");

        assert!(html.contains("<h1 id=\"שלום-עולם\">שלום עולם</h1>"));
    }

    #[test]
    fn fragment_links_are_preserved_for_generated_heading_ids() {
        let html = render_markdown_to_safe_html("[Jump](#my-section)\n\n## My Section");

        assert!(html.contains("<a href=\"#my-section\""));
        assert!(html.contains("<h2 id=\"my-section\">My Section</h2>"));
    }

    #[test]
    fn many_heading_ids_are_not_corrupted_by_placeholder_prefixes() {
        let html = render_markdown_to_safe_html(
            "# Root

## Alpha

## Beta

## Gamma

## Delta

## Epsilon

## Zeta

## Eta

## Theta

## Iota

## Duplicate heading

## Duplicate heading

## Install / Update",
        );

        assert!(html.contains("<h2 id=\"duplicate-heading\">Duplicate heading</h2>"));
        assert!(html.contains("<h2 id=\"duplicate-heading-1\">Duplicate heading</h2>"));
        assert!(html.contains("<h2 id=\"install-update\">Install / Update</h2>"));
        assert!(!html.contains("alpha0"));
        assert!(!html.contains("alpha1"));
        assert!(!html.contains("hushmark-heading-token"));
    }

    #[test]
    fn raw_html_heading_ids_and_attributes_are_still_stripped() {
        let html = render_markdown_to_safe_html(
            r#"<h2 id="my-section" class="evil" onclick="alert(1)">Raw</h2>

## My Section"#,
        );

        assert_eq!(html.matches("id=\"my-section\"").count(), 1);
        assert!(html.contains("<h2>Raw</h2>"));
        assert!(html.contains("<h2 id=\"my-section\">My Section</h2>"));
        assert!(!html.contains("onclick"));
        assert!(!html.contains("class=\"evil\""));
    }

    #[test]
    fn many_table_alignment_classes_are_not_corrupted_by_placeholder_prefixes() {
        let html = render_markdown_to_safe_html(
            "| Left | Center | Right |\n| :--- | :---: | ---: |\n| one | two | 3 |\n| four | five | 6 |\n| seven | eight | 9 |",
        );

        assert_eq!(html.matches("class=\"hushmark-align-left\"").count(), 4);
        assert_eq!(html.matches("class=\"hushmark-align-center\"").count(), 4);
        assert_eq!(html.matches("class=\"hushmark-align-right\"").count(), 4);
        assert!(!html.contains("hushmark-align-center0"));
        assert!(!html.contains("hushmark-align-right1"));
        assert!(!html.contains("hushmark-align-token"));
    }

    #[test]
    fn markdown_features_fixture_links_and_table_alignment_render_correctly() {
        let html =
            render_markdown_to_safe_html(include_str!("../../examples/markdown-features.md"));

        for fragment in [
            "h2-text-formatting",
            "tables",
            "heading-with-spaces",
            "duplicate-heading",
            "duplicate-heading-1",
            "install-update",
            "heading",
        ] {
            assert!(
                html.contains(&format!("href=\"#{fragment}\"")),
                "missing fixture href #{fragment}"
            );
            assert!(
                html.contains(&format!("id=\"{fragment}\"")),
                "missing fixture id {fragment}"
            );
        }

        assert!(html.contains("href=\"#%D7%A9%D7%9C%D7%95%D7%9D-%D7%A2%D7%95%D7%9C%D7%9D\""));
        assert!(html.contains("id=\"שלום-עולם\""));
        assert!(html.contains("href=\"#missing-fragment\""));
        assert!(!html.contains("id=\"missing-fragment\""));
        assert!(html.contains("<td class=\"hushmark-align-center\">middle</td>"));
        assert!(html.contains("<td class=\"hushmark-align-right\">789</td>"));
        assert!(!html.contains("hushmark-align-center0"));
        assert!(!html.contains("hushmark-heading-token"));
    }

    #[test]
    fn raw_html_table_styles_and_classes_are_still_stripped() {
        let html = render_markdown_to_safe_html(
            r#"<table>
<tr>
<td style="text-align: right" class="hushmark-align-right evil" onclick="alert(1)">Raw</td>
</tr>
</table>"#,
        );

        assert!(html.contains("<td"));
        assert!(html.contains("Raw"));
        assert!(!html.contains("style="));
        assert!(!html.contains("onclick"));
        assert!(!html.contains("hushmark-align-right"));
        assert!(!html.contains("evil"));
    }

    #[test]
    fn unsupported_markdown_extensions_remain_plain_content() {
        let html = render_markdown_to_safe_html(
            "- [x] Task item\n\nFootnote reference[^1]\n\n[^1]: Footnote body\n\n# Heading {#custom .accent}",
        );

        assert!(html.contains("[x] Task item"));
        assert!(!html.contains("checkbox"));
        assert!(html.contains("Footnote reference[^1]"));
        assert!(!html.contains("footnote-reference"));
        assert!(html.contains("Heading {#custom .accent}"));
        assert!(!html.contains("id=\"custom\""));
        assert!(!html.contains("class=\"accent\""));
    }

    #[test]
    fn sanitizes_unsafe_raw_html() {
        let html =
            render_markdown_to_safe_html("# Hello\n\n<script>alert('xss')</script>\n\n**world**");

        assert!(html.contains("<h1 id=\"hello\">Hello</h1>"));
        assert!(html.contains("<strong>world</strong>"));
        assert!(!html.contains("<script>"));
        assert!(!html.contains("alert('xss')"));
    }

    #[test]
    fn sanitizes_unsafe_attributes_and_links() {
        let html = render_markdown_to_safe_html(
            r#"<img src="example.png" alt="Example" onerror="alert(1)">
<a href="https://example.com" onclick="alert(1)">safe link</a>

[bad link](javascript:alert(1))
![bad image](javascript:alert(1))"#,
        );

        assert!(html.contains("src=\"example.png\""));
        assert!(html.contains("href=\"https://example.com\""));
        assert!(html.contains("safe link"));
        assert!(html.contains("bad link"));
        assert!(!html.contains("onerror"));
        assert!(!html.contains("onclick"));
        assert!(!html.contains("javascript:"));
    }

    #[test]
    fn resolves_relative_markdown_image_paths_against_document_directory() {
        let fixture = TestFixture::new("relative-image");
        let image_path = fixture.path.join("assets").join("example.png");
        fs::create_dir_all(image_path.parent().expect("image parent")).expect("create image dir");
        fs::write(&image_path, b"fake png").expect("write image");

        let document_path = fixture.path.join("doc.md");
        fs::write(&document_path, "![Example](assets/example.png)").expect("write Markdown");

        let document = load_markdown_file(document_path);
        let html = document.html.expect("rendered HTML");

        assert!(html.contains("src=\"data:image/png;base64,"));
        assert!(html.contains("alt=\"Example\""));
        assert!(!html.contains("assets/example.png"));
    }

    #[test]
    fn resolves_markdown_image_paths_with_spaces() {
        let fixture = TestFixture::new("spaced-image");
        let image_path = fixture
            .path
            .join("assets with spaces")
            .join("image with spaces.jpg");
        fs::create_dir_all(image_path.parent().expect("image parent")).expect("create image dir");
        fs::write(&image_path, b"fake jpg").expect("write image");

        let document_path = fixture.path.join("doc.md");
        fs::write(
            &document_path,
            "![Spaced](<assets with spaces/image with spaces.jpg>)",
        )
        .expect("write Markdown");

        let document = load_markdown_file(document_path);
        let html = document.html.expect("rendered HTML");

        assert!(html.contains("src=\"data:image/jpeg;base64,"));
        assert!(html.contains("alt=\"Spaced\""));
        assert!(!html.contains("image with spaces.jpg"));
    }

    #[test]
    fn resolves_markdown_image_paths_with_unicode_names() {
        let fixture = TestFixture::new("unicode-image");
        let image_path = fixture.path.join("assets").join("שלום.webp");
        fs::create_dir_all(image_path.parent().expect("image parent")).expect("create image dir");
        fs::write(&image_path, b"fake webp").expect("write image");

        let document_path = fixture.path.join("doc.md");
        fs::write(&document_path, "![Hebrew](<assets/שלום.webp>)").expect("write Markdown");

        let document = load_markdown_file(document_path);
        let html = document.html.expect("rendered HTML");

        assert!(html.contains("src=\"data:image/webp;base64,"));
        assert!(html.contains("alt=\"Hebrew\""));
        assert!(!html.contains("שלום.webp"));
    }

    #[test]
    fn keeps_remote_markdown_image_urls_unchanged() {
        let html = render_markdown_to_safe_html("![Remote](https://example.com/image.png)");

        assert!(html.contains("src=\"https://example.com/image.png\""));
        assert!(html.contains("alt=\"Remote\""));
    }

    #[test]
    fn rejects_traversal_and_unsupported_local_markdown_image_paths() {
        let fixture = TestFixture::new("rejected-images");
        let assets_dir = fixture.path.join("assets");
        fs::create_dir_all(&assets_dir).expect("create image dir");
        fs::write(fixture.path.join("secret.png"), b"fake png").expect("write nearby image");
        fs::write(assets_dir.join("notes.txt"), b"not an image").expect("write text");

        let document_path = fixture.path.join("doc.md");
        fs::write(
            &document_path,
            "![Traversal](../secret.png)\n\n![Text](assets/notes.txt)",
        )
        .expect("write Markdown");

        let document = load_markdown_file(document_path);
        let html = document.html.expect("rendered HTML");

        assert!(html.contains("alt=\"Traversal\""));
        assert!(html.contains("alt=\"Text\""));
        assert!(!html.contains("../secret.png"));
        assert!(!html.contains("assets/notes.txt"));
        assert!(!html.contains("data:image/"));
    }

    #[test]
    fn resolves_relative_raw_html_image_paths_against_document_directory() {
        let fixture = TestFixture::new("raw-html-image");
        let assets_dir = fixture.path.join("assets");
        fs::create_dir_all(&assets_dir).expect("create image dir");
        fs::write(assets_dir.join("example.gif"), b"fake gif").expect("write gif");
        fs::write(assets_dir.join("example.png"), b"fake png").expect("write png");
        fs::write(assets_dir.join("example.svg"), b"<svg></svg>").expect("write svg");

        let document_path = fixture.path.join("doc.md");
        fs::write(
            &document_path,
            r#"<img src="./assets/example.gif" alt="Raw GIF">
<img src="assets/example.png" alt="Raw PNG">
<img src="assets/example.svg" alt="Raw SVG">

![Markdown](assets/example.svg)"#,
        )
        .expect("write Markdown");

        let document = load_markdown_file(document_path);
        let html = document.html.expect("rendered HTML");

        assert!(html.contains("src=\"data:image/gif;base64,"));
        assert!(html.contains("src=\"data:image/png;base64,"));
        assert!(html.contains("src=\"data:image/svg+xml;base64,"));
        assert!(html.contains("alt=\"Raw GIF\""));
        assert!(html.contains("alt=\"Raw PNG\""));
        assert!(html.contains("alt=\"Raw SVG\""));
        assert!(html.contains("alt=\"Markdown\""));
        assert!(!html.contains("./assets/example.gif"));
        assert!(!html.contains("assets/example.png"));
        assert!(!html.contains("assets/example.svg"));
    }

    #[test]
    fn keeps_remote_raw_html_image_urls_unchanged() {
        let html = render_markdown_to_safe_html(
            r#"<img src="https://example.com/badge.svg" alt="Remote">"#,
        );

        assert!(html.contains("src=\"https://example.com/badge.svg\""));
        assert!(html.contains("alt=\"Remote\""));
    }

    #[test]
    fn rejects_unsafe_raw_html_image_sources_and_attributes() {
        let fixture = TestFixture::new("unsafe-raw-html-images");
        let assets_dir = fixture.path.join("assets");
        fs::create_dir_all(&assets_dir).expect("create image dir");
        fs::write(fixture.path.join("secret.png"), b"fake png").expect("write nearby image");
        fs::write(assets_dir.join("notes.txt"), b"not an image").expect("write text");

        let document_path = fixture.path.join("doc.md");
        fs::write(
            &document_path,
            r#"<img src="../secret.png" alt="Traversal" onerror="alert(1)" style="width:100px">
<img src="assets/notes.txt" alt="Text">
<img src="file:///C:/Users/example/secret.png" alt="File">
<img src="C:\Users\example\secret.png" alt="Absolute">
<img src="javascript:alert(1)" alt="Script">
<script>alert("xss")</script>"#,
        )
        .expect("write Markdown");

        let document = load_markdown_file(document_path);
        let html = document.html.expect("rendered HTML");

        assert!(html.contains("alt=\"Traversal\""));
        assert!(html.contains("alt=\"Text\""));
        assert!(html.contains("alt=\"File\""));
        assert!(html.contains("alt=\"Absolute\""));
        assert!(html.contains("alt=\"Script\""));
        assert!(!html.contains("../secret.png"));
        assert!(!html.contains("assets/notes.txt"));
        assert!(!html.contains("file:///"));
        assert!(!html.contains("C:\\Users"));
        assert!(!html.contains("javascript:"));
        assert!(!html.contains("onerror"));
        assert!(!html.contains("style="));
        assert!(!html.contains("<script>"));
        assert!(!html.contains("data:image/"));
    }

    #[test]
    fn does_not_pass_file_scheme_markdown_images_through() {
        let html = render_markdown_to_safe_html("![File](file:///C:/Users/example/secret.png)");

        assert!(html.contains("alt=\"File\""));
        assert!(!html.contains("file:///"));
        assert!(!html.contains("secret.png"));
        assert!(!html.contains("data:image/"));
    }

    #[test]
    fn title_uses_file_name_when_loaded() {
        let document = LoadedDocument {
            path: Some("notes.md".to_string()),
            navigation_root: None,
            file_name: Some("notes.md".to_string()),
            html: Some("<h1>Notes</h1>".to_string()),
            error: None,
        };

        assert_eq!(title_for(&document), "notes.md - Hushmark");
    }

    #[test]
    fn no_initial_arg_returns_empty_document() {
        let document = load_initial_document_from_arg(None);

        assert!(document.path.is_none());
        assert!(document.html.is_none());
        assert!(document.error.is_none());
    }

    #[test]
    fn missing_file_returns_error_document() {
        let document = load_markdown_file(env::temp_dir().join("hushmark-missing.md"));

        assert!(document.html.is_none());
        assert!(document
            .error
            .as_deref()
            .is_some_and(|error| error.contains("could not find")));
    }

    #[test]
    fn invalid_utf8_returns_error_document() {
        let path = env::temp_dir().join(format!("hushmark-invalid-{}.md", std::process::id()));

        fs::write(&path, [0xff, 0xfe, 0xfd]).expect("write invalid UTF-8 fixture");
        let document = load_markdown_file(path.clone());
        let _ = fs::remove_file(path);

        assert!(document.html.is_none());
        assert!(document
            .error
            .as_deref()
            .is_some_and(|error| error.contains("UTF-8 Markdown")));
    }

    #[test]
    fn dropped_markdown_file_uses_loader() {
        let path = env::temp_dir().join(format!("hushmark-dropped-{}.md", std::process::id()));

        fs::write(&path, "# Dropped").expect("write dropped Markdown fixture");
        let document = load_dropped_markdown_file(path.clone());
        let _ = fs::remove_file(path);

        assert!(document
            .html
            .as_deref()
            .unwrap_or_default()
            .contains("Dropped"));
        assert!(document.error.is_none());
    }

    #[test]
    fn dropped_non_markdown_file_returns_error_document() {
        let path = env::temp_dir().join("hushmark-dropped.txt");
        let document = load_dropped_markdown_file(path);

        assert!(document.html.is_none());
        assert!(document.error.is_some());
    }

    #[test]
    fn linked_relative_md_document_opens_inside_navigation_root() {
        let fixture = TestFixture::new("linked-md");
        let current_path = fixture.path.join("index.md");
        let target_path = fixture.path.join("chapter-2.md");
        fs::write(&current_path, "# Index").expect("write current");
        fs::write(&target_path, "# Chapter 2").expect("write target");

        let linked =
            load_linked_markdown_file(current_path, fixture.path.clone(), "chapter-2.md".into());

        assert!(linked.fragment.is_none());
        assert!(linked.document.error.is_none());
        assert!(linked
            .document
            .html
            .as_deref()
            .is_some_and(|html| html.contains("Chapter 2")));
        let expected_root = fixture
            .path
            .canonicalize()
            .expect("canonical root")
            .display()
            .to_string();
        assert_eq!(
            linked.document.navigation_root.as_deref(),
            Some(expected_root.as_str())
        );
    }

    #[test]
    fn linked_relative_markdown_document_opens_with_fragment() {
        let fixture = TestFixture::new("linked-markdown-fragment");
        let current_path = fixture.path.join("index.md");
        let target_path = fixture.path.join("setup.markdown");
        fs::write(&current_path, "# Index").expect("write current");
        fs::write(&target_path, "# Setup\n\n## Install Hushmark").expect("write target");

        let linked = load_linked_markdown_file(
            current_path,
            fixture.path.clone(),
            "setup.markdown#install-hushmark".into(),
        );

        assert_eq!(linked.fragment.as_deref(), Some("install-hushmark"));
        assert!(linked.document.error.is_none());
        assert!(linked
            .document
            .html
            .as_deref()
            .is_some_and(|html| html.contains("id=\"install-hushmark\"")));
    }

    #[test]
    fn child_document_can_link_back_up_within_navigation_root() {
        let fixture = TestFixture::new("linked-child-back");
        let nested_dir = fixture.path.join("nested");
        fs::create_dir_all(&nested_dir).expect("create nested dir");
        let root_doc = fixture.path.join("index.md");
        let child_doc = nested_dir.join("child.md");
        fs::write(&root_doc, "# Root\n\n## Back Target").expect("write root");
        fs::write(&child_doc, "# Child").expect("write child");

        let linked = load_linked_markdown_file(
            child_doc,
            fixture.path.clone(),
            "../index.md#back-target".into(),
        );

        assert_eq!(linked.fragment.as_deref(), Some("back-target"));
        assert!(linked.document.error.is_none());
        assert!(linked
            .document
            .html
            .as_deref()
            .is_some_and(|html| html.contains("id=\"back-target\"")));
    }

    #[test]
    fn linked_document_rejects_escape_outside_navigation_root() {
        let fixture = TestFixture::new("linked-escape");
        let outside = fixture
            .path
            .parent()
            .expect("fixture parent")
            .join(format!("hushmark-outside-{}.md", std::process::id()));
        let current_path = fixture.path.join("index.md");
        fs::write(&current_path, "# Index").expect("write current");
        fs::write(&outside, "# Outside").expect("write outside");

        let linked = load_linked_markdown_file(
            current_path,
            fixture.path.clone(),
            format!("../{}", outside.file_name().unwrap().to_string_lossy()),
        );
        let _ = fs::remove_file(outside);

        assert!(linked.document.html.is_none());
        assert!(linked
            .document
            .error
            .as_deref()
            .is_some_and(|error| error.contains("outside")));
    }

    #[test]
    fn linked_document_rejects_absolute_file_and_unsupported_schemes() {
        let fixture = TestFixture::new("linked-rejected-schemes");
        let current_path = fixture.path.join("index.md");
        let target_path = fixture.path.join("target.md");
        fs::write(&current_path, "# Index").expect("write current");
        fs::write(&target_path, "# Target").expect("write target");

        for href in [
            target_path.display().to_string(),
            "file:///C:/Users/example/notes.md".to_string(),
            "https://example.com/notes.md".to_string(),
        ] {
            let linked =
                load_linked_markdown_file(current_path.clone(), fixture.path.clone(), href);

            assert!(linked.document.html.is_none());
            assert!(linked.document.error.is_some());
        }
    }

    #[test]
    fn linked_document_rejects_unsupported_extension_and_malformed_links() {
        let fixture = TestFixture::new("linked-rejected-files");
        let current_path = fixture.path.join("index.md");
        let text_path = fixture.path.join("notes.txt");
        fs::write(&current_path, "# Index").expect("write current");
        fs::write(&text_path, "notes").expect("write text");

        for href in ["notes.txt", "bad%FF.md", ""] {
            let linked = load_linked_markdown_file(
                current_path.clone(),
                fixture.path.clone(),
                href.to_string(),
            );

            assert!(linked.document.html.is_none(), "{href}");
            assert!(linked.document.error.is_some(), "{href}");
        }
    }

    struct TestFixture {
        path: std::path::PathBuf,
    }

    impl TestFixture {
        fn new(name: &str) -> Self {
            let path = env::temp_dir().join(format!("hushmark-{name}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&path);
            fs::create_dir_all(&path).expect("create fixture directory");
            Self { path }
        }
    }

    impl Drop for TestFixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}
