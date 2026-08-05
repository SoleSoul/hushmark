use std::ffi::OsString;

pub fn first_document_arg(mut args: impl Iterator<Item = OsString>) -> Option<OsString> {
    args.next()
}

#[cfg(test)]
mod tests {
    use super::first_document_arg;
    use std::ffi::OsString;

    #[test]
    fn first_document_arg_preserves_first_value_without_flag_handling() {
        for value in ["--unsupported-flag", "notes.md"] {
            let args = vec![OsString::from(value)];

            assert_eq!(
                first_document_arg(args.into_iter()),
                Some(OsString::from(value))
            );
        }
    }
}
