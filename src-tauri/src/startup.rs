use std::ffi::OsString;

#[cfg(windows)]
use std::ffi::OsStr;

#[cfg(windows)]
pub fn is_setup_mode_arg(arg: &OsStr) -> bool {
    arg == "--setup"
}

pub fn first_document_arg(mut args: impl Iterator<Item = OsString>) -> Option<OsString> {
    args.next()
}

#[cfg(test)]
mod tests {
    use super::first_document_arg;
    use std::ffi::OsString;

    #[cfg(windows)]
    #[test]
    fn detects_setup_mode_arg() {
        assert!(super::is_setup_mode_arg("--setup".as_ref()));
        assert!(!super::is_setup_mode_arg("--install".as_ref()));
        assert!(!super::is_setup_mode_arg("notes.md".as_ref()));
    }

    #[test]
    fn first_document_arg_preserves_flag_like_text() {
        for value in ["--setup", "--unsupported_flag", "notes.md"] {
            let args = vec![OsString::from(value)];

            assert_eq!(
                first_document_arg(args.into_iter()),
                Some(OsString::from(value))
            );
        }
    }
}
