use std::collections::HashSet;

use ammonia::Builder;
use serde_yaml_ng::Value;

const FRONT_MATTER_CLASS: &str = "hushmark-front-matter";

pub(crate) struct DocumentParts<'a> {
    pub(crate) front_matter: Option<FrontMatter>,
    pub(crate) markdown: &'a str,
    pub(crate) markdown_start: usize,
}

pub(crate) struct FrontMatter {
    fields: Vec<(String, String)>,
}

pub(crate) fn parse_document_parts(source: &str) -> DocumentParts<'_> {
    let Some((front_matter, markdown_start)) = parse_yaml_front_matter(source) else {
        return DocumentParts {
            front_matter: None,
            markdown: source,
            markdown_start: 0,
        };
    };

    DocumentParts {
        front_matter: Some(front_matter),
        markdown: &source[markdown_start..],
        markdown_start,
    }
}

pub(crate) fn render_front_matter_to_safe_html(front_matter: Option<&FrontMatter>) -> String {
    let Some(front_matter) = front_matter.filter(|front_matter| !front_matter.fields.is_empty())
    else {
        return String::new();
    };

    let mut rendered = String::from("<dl class=\"hushmark-front-matter\">");

    for (key, value) in &front_matter.fields {
        rendered.push_str("<dt>");
        rendered.push_str(&escape_html_text(key));
        rendered.push_str("</dt><dd>");
        rendered.push_str(&escape_html_text(value));
        rendered.push_str("</dd>");
    }

    rendered.push_str("</dl>\n");

    let allowed_tags = HashSet::from(["dl", "dt", "dd"]);
    let allowed_classes = [FRONT_MATTER_CLASS];
    let mut builder = Builder::default();
    builder.tags(allowed_tags);
    builder.add_allowed_classes("dl", &allowed_classes);
    builder.clean(&rendered).to_string()
}

fn parse_yaml_front_matter(source: &str) -> Option<(FrontMatter, usize)> {
    let mut lines = source.split_inclusive('\n');
    let first_line = lines.next()?;

    if line_content(first_line) != "---" {
        return None;
    }

    let yaml_start = first_line.len();
    let mut line_start = yaml_start;

    for line in lines {
        if line_content(line) == "---" {
            let markdown_start = line_start + line.len();
            let value = serde_yaml_ng::from_str::<Value>(&source[yaml_start..line_start]).ok()?;

            return Some((
                FrontMatter {
                    fields: yaml_fields(value),
                },
                markdown_start,
            ));
        }

        line_start += line.len();
    }

    None
}

fn line_content(line: &str) -> &str {
    let line = line.strip_suffix('\n').unwrap_or(line);
    line.strip_suffix('\r').unwrap_or(line)
}

fn yaml_fields(value: Value) -> Vec<(String, String)> {
    match value {
        Value::Mapping(mapping) => mapping
            .into_iter()
            .map(|(key, value)| (plain_yaml_value(&key), plain_yaml_value(&value)))
            .collect(),
        Value::Null => Vec::new(),
        value => vec![("Value".to_string(), plain_yaml_value(&value))],
    }
}

fn plain_yaml_value(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        Value::String(value) => value.clone(),
        Value::Sequence(values) => values
            .iter()
            .map(plain_yaml_value)
            .collect::<Vec<_>>()
            .join(", "),
        Value::Mapping(mapping) => mapping
            .iter()
            .map(|(key, value)| format!("{}: {}", plain_yaml_value(key), plain_yaml_value(value)))
            .collect::<Vec<_>>()
            .join(", "),
        Value::Tagged(tagged) => plain_yaml_value(&tagged.value),
    }
}

fn escape_html_text(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());

    for character in value.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&#39;"),
            _ => escaped.push(character),
        }
    }

    escaped
}

#[cfg(test)]
mod tests {
    use super::{parse_document_parts, render_front_matter_to_safe_html};

    #[test]
    fn valid_yaml_front_matter_returns_structured_metadata_and_untouched_markdown() {
        let source = "---\ntitle: Guide\ndraft: false\n---\n# Introduction\n\nBody";
        let parts = parse_document_parts(source);

        assert_eq!(parts.markdown, "# Introduction\n\nBody");
        assert_eq!(parts.markdown_start, source.find("# Introduction").unwrap());

        let html = render_front_matter_to_safe_html(parts.front_matter.as_ref());
        assert!(html.contains("<dt>title</dt><dd>Guide</dd>"));
        assert!(html.contains("<dt>draft</dt><dd>false</dd>"));
    }

    #[test]
    fn missing_closing_delimiter_keeps_the_entire_source_as_markdown() {
        let source = "---\ntitle: Still visible\n# Body";
        let parts = parse_document_parts(source);

        assert!(parts.front_matter.is_none());
        assert_eq!(parts.markdown, source);
        assert_eq!(parts.markdown_start, 0);
    }

    #[test]
    fn malformed_yaml_keeps_the_entire_source_as_markdown() {
        let source = "---\ntitle: [broken\n---\n# Body";
        let parts = parse_document_parts(source);

        assert!(parts.front_matter.is_none());
        assert_eq!(parts.markdown, source);
        assert_eq!(parts.markdown_start, 0);
    }

    #[test]
    fn ordinary_horizontal_rules_are_not_front_matter() {
        let source = "Before\n\n---\n\nAfter";
        let parts = parse_document_parts(source);

        assert!(parts.front_matter.is_none());
        assert_eq!(parts.markdown, source);
    }

    #[test]
    fn setext_headings_are_not_front_matter() {
        let source = "Document title\n---\n\nBody";
        let parts = parse_document_parts(source);

        assert!(parts.front_matter.is_none());
        assert_eq!(parts.markdown, source);
    }

    #[test]
    fn empty_front_matter_returns_no_visible_metadata() {
        let source = "---\n---\n# Body";
        let parts = parse_document_parts(source);

        assert_eq!(parts.markdown, "# Body");
        assert!(render_front_matter_to_safe_html(parts.front_matter.as_ref()).is_empty());
    }

    #[test]
    fn lists_nested_values_and_quotes_render_as_escaped_plain_text() {
        let source = "---\ntitle: \"A quoted value\"\ndescription: \"**plain**, not Markdown\"\ntags: [ai, markdown]\nowner:\n  name: Reader <script>alert(1)</script>\n---\nBody";
        let parts = parse_document_parts(source);
        let html = render_front_matter_to_safe_html(parts.front_matter.as_ref());

        assert!(html.contains("<dt>title</dt><dd>A quoted value</dd>"));
        assert!(html.contains("<dt>description</dt><dd>**plain**, not Markdown</dd>"));
        assert!(html.contains("<dt>tags</dt><dd>ai, markdown</dd>"));
        assert!(html
            .contains("<dt>owner</dt><dd>name: Reader &lt;script&gt;alert(1)&lt;/script&gt;</dd>"));
        assert!(!html.contains("<script>"));
        assert!(!html.contains("<strong>"));
    }

    #[test]
    fn markdown_start_translates_body_offsets_to_source_offsets() {
        let source = "---\ntitle: שלום\n---\n# Body\n\n[Jump](#body)";
        let parts = parse_document_parts(source);
        let body_heading_offset = parts.markdown.find("# Body").unwrap();

        assert_eq!(
            parts.markdown_start + body_heading_offset,
            source.find("# Body").unwrap()
        );
        assert_eq!(parts.markdown, &source[parts.markdown_start..]);
    }

    #[test]
    fn crlf_delimiters_return_an_untouched_crlf_markdown_body() {
        let source = "---\r\ntitle: Guide\r\n---\r\n# Body\r\n\r\nText";
        let parts = parse_document_parts(source);

        assert_eq!(parts.markdown, "# Body\r\n\r\nText");
        assert_eq!(parts.markdown, &source[parts.markdown_start..]);
    }
}
