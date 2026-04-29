use std::{
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
};

use ammonia::Builder;
use pulldown_cmark::{html, Options, Parser};
use serde::Serialize;

use crate::identity::DISPLAY_NAME;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedDocument {
    pub path: Option<String>,
    pub file_name: Option<String>,
    pub html: Option<String>,
    pub error: Option<String>,
}

impl LoadedDocument {
    fn empty() -> Self {
        Self {
            path: None,
            file_name: None,
            html: None,
            error: None,
        }
    }

    fn loaded(path: &Path, html: String) -> Self {
        Self {
            path: Some(path.display().to_string()),
            file_name: Some(file_name(path)),
            html: Some(html),
            error: None,
        }
    }

    fn failed(path: &Path, error: String) -> Self {
        Self {
            path: Some(path.display().to_string()),
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
    match fs::read_to_string(&path) {
        Ok(markdown) => {
            let html = render_markdown_to_safe_html(&markdown);
            LoadedDocument::loaded(&path, html)
        }
        Err(error) => {
            LoadedDocument::failed(&path, format!("Could not read {}: {error}", path.display()))
        }
    }
}

pub fn load_dropped_markdown_file(path: PathBuf) -> LoadedDocument {
    if !is_markdown_path(&path) {
        return LoadedDocument::failed(
            &path,
            format!(
                "Only .md and .markdown files can be dropped. {} was not opened.",
                path.display()
            ),
        );
    }

    load_markdown_file(path)
}

pub fn title_for(document: &LoadedDocument) -> String {
    match (&document.file_name, &document.error) {
        (Some(file_name), Some(_)) => format!("Error: {file_name} - {DISPLAY_NAME}"),
        (Some(file_name), None) => format!("{file_name} - {DISPLAY_NAME}"),
        (None, Some(_)) => format!("Error - {DISPLAY_NAME}"),
        (None, None) => DISPLAY_NAME.to_string(),
    }
}

fn render_markdown_to_safe_html(markdown: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);

    let parser = Parser::new_ext(markdown, options);
    let mut rendered = String::new();
    html::push_html(&mut rendered, parser);

    Builder::default().clean(&rendered).to_string()
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(str::to_owned)
        .unwrap_or_else(|| path.display().to_string())
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

    use super::{
        load_dropped_markdown_file, load_initial_document_from_arg, load_markdown_file,
        render_markdown_to_safe_html, title_for, LoadedDocument,
    };

    #[test]
    fn renders_markdown_without_unsafe_html() {
        let html =
            render_markdown_to_safe_html("# Hello\n\n<script>alert('xss')</script>\n\n**world**");

        assert!(html.contains("<h1>Hello</h1>"));
        assert!(html.contains("<strong>world</strong>"));
        assert!(!html.contains("<script>"));
    }

    #[test]
    fn title_uses_file_name_when_loaded() {
        let document = LoadedDocument {
            path: Some("notes.md".to_string()),
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
        assert!(document.error.is_some());
    }

    #[test]
    fn invalid_utf8_returns_error_document() {
        let path = env::temp_dir().join(format!("hushmark-invalid-{}.md", std::process::id()));

        fs::write(&path, [0xff, 0xfe, 0xfd]).expect("write invalid UTF-8 fixture");
        let document = load_markdown_file(path.clone());
        let _ = fs::remove_file(path);

        assert!(document.html.is_none());
        assert!(document.error.is_some());
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
}
