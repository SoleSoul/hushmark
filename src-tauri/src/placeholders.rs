//! Trusted-markup placeholders for the sanitized Markdown pipeline.
//!
//! Hushmark sanitizes the complete rendered document, because raw author HTML
//! can span many Markdown events. Markup that Hushmark itself adds (heading
//! ids, table alignment classes, math spans, Mermaid fences, task markers, and
//! embedded local images) would otherwise be removed by the sanitizer or could
//! be forged by raw author HTML. Each such value is emitted as an unguessable
//! token that the sanitizer allows, and all tokens are swapped for their real
//! markup in a single pass afterwards.

use std::{
    collections::hash_map::RandomState,
    hash::{BuildHasher, Hasher},
    time::{SystemTime, UNIX_EPOCH},
};

pub(crate) const PLACEHOLDER_MARKER: &str = "hushmark-token-";

const LOCAL_IMAGE_URL_PREFIX: &str = "https://hushmark.local/";

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum Slot {
    /// The `id` attribute of a heading.
    HeadingId,
    /// The `class` attribute of a table cell.
    TableCellClass,
    /// A fenced code block's info string, which becomes `class="language-…"`.
    CodeLanguage,
    /// The `class` attribute of a math span.
    MathClass,
    /// An empty `<span class="…"></span>` replaced by a task-list checkbox.
    TaskListMarker,
    /// An image `src` URL replaced by an embedded `data:` URL.
    ImageSource,
}

impl Slot {
    /// Text that surrounds the token in sanitized HTML and is replaced along
    /// with it.
    fn surroundings(self) -> (&'static str, &'static str) {
        match self {
            Self::HeadingId | Self::TableCellClass | Self::MathClass => ("", ""),
            Self::CodeLanguage => ("language-", ""),
            Self::TaskListMarker => ("<span class=\"", "\"></span>"),
            Self::ImageSource => (LOCAL_IMAGE_URL_PREFIX, ""),
        }
    }
}

struct Replacement {
    slot: Slot,
    value: String,
}

pub(crate) struct Placeholders {
    prefix: String,
    replacements: Vec<Replacement>,
}

impl Placeholders {
    pub(crate) fn new() -> Self {
        Self {
            prefix: format!("{PLACEHOLDER_MARKER}{}-", unpredictable_hex()),
            replacements: Vec::new(),
        }
    }

    /// Records the markup that should replace a new token and returns the text
    /// to emit before sanitization.
    pub(crate) fn insert(&mut self, slot: Slot, value: impl Into<String>) -> String {
        let token = self.token(self.replacements.len());
        self.replacements.push(Replacement {
            slot,
            value: value.into(),
        });

        match slot {
            Slot::ImageSource => format!("{LOCAL_IMAGE_URL_PREFIX}{token}"),
            _ => token,
        }
    }

    /// Attribute values the sanitizer must allow for the given slots.
    pub(crate) fn allowed_attribute_values(&self, slots: &[Slot]) -> Vec<String> {
        self.replacements
            .iter()
            .enumerate()
            .filter(|(_, replacement)| slots.contains(&replacement.slot))
            .map(|(index, replacement)| match replacement.slot {
                Slot::CodeLanguage => format!("language-{}", self.token(index)),
                _ => self.token(index),
            })
            .collect()
    }

    /// Replaces every recorded token, with its surroundings, in one pass.
    /// Tokens whose surroundings were altered are left untouched.
    pub(crate) fn apply(&self, html: &str) -> String {
        let mut output = String::with_capacity(
            html.len()
                + self
                    .replacements
                    .iter()
                    .map(|replacement| replacement.value.len())
                    .sum::<usize>(),
        );
        let mut copied = 0;

        for (token_start, _) in html.match_indices(&self.prefix) {
            if token_start < copied {
                continue;
            }

            let index_start = token_start + self.prefix.len();
            let index_end = index_start
                + html[index_start..]
                    .bytes()
                    .take_while(u8::is_ascii_digit)
                    .count();
            let Some(replacement) = html[index_start..index_end]
                .parse::<usize>()
                .ok()
                .and_then(|index| self.replacements.get(index))
            else {
                continue;
            };

            let (before, after) = replacement.slot.surroundings();
            let Some(replace_start) = token_start.checked_sub(before.len()) else {
                continue;
            };
            if replace_start < copied
                || !html[..token_start].ends_with(before)
                || !html[index_end..].starts_with(after)
            {
                continue;
            }

            output.push_str(&html[copied..replace_start]);
            output.push_str(&replacement.value);
            copied = index_end + after.len();
        }

        output.push_str(&html[copied..]);
        output
    }

    fn token(&self, index: usize) -> String {
        format!("{}{index}", self.prefix)
    }
}

/// 128 bits from the standard library's randomly keyed hasher, so document
/// authors cannot predict the tokens without adding a dependency.
fn unpredictable_hex() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let mut words = [0u64; 2];

    for (index, word) in words.iter_mut().enumerate() {
        let mut hasher = RandomState::new().build_hasher();
        hasher.write_u128(nanos);
        hasher.write_usize(index);
        *word = hasher.finish();
    }

    format!("{:016x}{:016x}", words[0], words[1])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_are_unique_per_render() {
        assert_ne!(Placeholders::new().prefix, Placeholders::new().prefix);
    }

    #[test]
    fn replaces_tokens_with_their_surroundings() {
        let mut placeholders = Placeholders::new();
        let heading = placeholders.insert(Slot::HeadingId, "intro");
        let code = placeholders.insert(Slot::CodeLanguage, "mermaid-source");
        let marker = placeholders.insert(Slot::TaskListMarker, "<input disabled>");
        let image = placeholders.insert(Slot::ImageSource, "data:image/png;base64,AA==");
        let html = format!(
            "<h1 id=\"{heading}\"></h1><code class=\"language-{code}\"></code>\
             <span class=\"{marker}\"></span><img src=\"{image}\">"
        );

        assert_eq!(
            placeholders.apply(&html),
            "<h1 id=\"intro\"></h1><code class=\"mermaid-source\"></code>\
             <input disabled><img src=\"data:image/png;base64,AA==\">"
        );
    }

    #[test]
    fn distinguishes_tokens_that_share_a_numeric_prefix() {
        let mut placeholders = Placeholders::new();
        let tokens: Vec<String> = (0..12)
            .map(|index| placeholders.insert(Slot::HeadingId, format!("h{index}")))
            .collect();
        let html = format!("{}|{}|{}", tokens[1], tokens[10], tokens[11]);

        assert_eq!(placeholders.apply(&html), "h1|h10|h11");
    }

    #[test]
    fn leaves_tokens_with_altered_surroundings_untouched() {
        let mut placeholders = Placeholders::new();
        let marker = placeholders.insert(Slot::TaskListMarker, "<input disabled>");
        let html = format!("<span class=\"{marker}\">text</span>");

        assert_eq!(placeholders.apply(&html), html);
    }

    #[test]
    fn allows_only_the_requested_slots() {
        let mut placeholders = Placeholders::new();
        let heading = placeholders.insert(Slot::HeadingId, "intro");
        let code = placeholders.insert(Slot::CodeLanguage, "mermaid-source");

        assert_eq!(
            placeholders.allowed_attribute_values(&[Slot::HeadingId]),
            vec![heading]
        );
        assert_eq!(
            placeholders.allowed_attribute_values(&[Slot::CodeLanguage]),
            vec![format!("language-{code}")]
        );
    }
}
