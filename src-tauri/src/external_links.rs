const HTTP_SCHEME: &str = "http";
const HTTPS_SCHEME: &str = "https";
const MAILTO_SCHEME: &str = "mailto";

pub fn normalize_allowed_external_url(url: &str) -> Option<String> {
    let trimmed = url.trim();
    if trimmed.is_empty() || trimmed.chars().any(char::is_control) {
        return None;
    }

    let (scheme, rest) = split_scheme(trimmed)?;
    if !is_valid_scheme(scheme) {
        return None;
    }

    if scheme.eq_ignore_ascii_case(HTTP_SCHEME) || scheme.eq_ignore_ascii_case(HTTPS_SCHEME) {
        if rest.strip_prefix("//").is_some_and(has_authority) {
            return Some(trimmed.to_string());
        }

        return None;
    }

    if scheme.eq_ignore_ascii_case(MAILTO_SCHEME) && !rest.is_empty() {
        return Some(trimmed.to_string());
    }

    None
}

pub fn open_external_link(url: &str) -> Result<(), String> {
    let url = normalize_allowed_external_url(url)
        .ok_or_else(|| "Unsupported external link scheme.".to_string())?;
    open_allowed_external_url(&url)
}

fn split_scheme(url: &str) -> Option<(&str, &str)> {
    let scheme_end = url.find(':')?;
    let scheme = &url[..scheme_end];
    let rest = &url[scheme_end + 1..];
    Some((scheme, rest))
}

fn has_authority(authority_and_path: &str) -> bool {
    !authority_and_path.is_empty()
        && !authority_and_path.starts_with('/')
        && !authority_and_path.starts_with('?')
        && !authority_and_path.starts_with('#')
}

fn is_valid_scheme(scheme: &str) -> bool {
    let mut characters = scheme.chars();
    let Some(first) = characters.next() else {
        return false;
    };

    first.is_ascii_alphabetic()
        && characters.all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '+' | '-' | '.')
        })
}

#[cfg(windows)]
fn open_allowed_external_url(url: &str) -> Result<(), String> {
    use windows_sys::Win32::UI::Shell::ShellExecuteW;

    let operation = wide_null("open");
    let url = wide_null(url);
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            operation.as_ptr(),
            url.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            1,
        )
    } as isize;

    if result > 32 {
        Ok(())
    } else {
        Err(format!(
            "ShellExecuteW returned {result} while opening an external link. Last OS error: {}",
            std::io::Error::last_os_error()
        ))
    }
}

#[cfg(not(windows))]
fn open_allowed_external_url(_url: &str) -> Result<(), String> {
    Err("External link opening is only available on Windows.".to_string())
}

#[cfg(windows)]
fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::normalize_allowed_external_url;

    #[test]
    fn allows_http_and_https_links() {
        assert_eq!(
            normalize_allowed_external_url("https://example.com/path?q=1#section"),
            Some("https://example.com/path?q=1#section".to_string())
        );
        assert_eq!(
            normalize_allowed_external_url("HTTP://example.com"),
            Some("HTTP://example.com".to_string())
        );
    }

    #[test]
    fn allows_mailto_links() {
        assert_eq!(
            normalize_allowed_external_url("mailto:reader@example.com"),
            Some("mailto:reader@example.com".to_string())
        );
    }

    #[test]
    fn rejects_fragment_relative_and_unsupported_links() {
        for url in [
            "#section",
            "notes.md",
            "ftp://example.com/file.md",
            "file:///C:/Users/example/notes.md",
            "data:text/plain,hello",
            "javascript:alert(1)",
        ] {
            assert_eq!(normalize_allowed_external_url(url), None, "{url}");
        }
    }

    #[test]
    fn rejects_http_without_authority_and_empty_mailto() {
        for url in ["https:example.com", "https:///path", "http://", "mailto:"] {
            assert_eq!(normalize_allowed_external_url(url), None, "{url}");
        }
    }

    #[test]
    fn rejects_control_characters() {
        assert_eq!(
            normalize_allowed_external_url("https://example.com/\nnext"),
            None
        );
    }
}
