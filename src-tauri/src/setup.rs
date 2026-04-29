use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
};

use serde::Serialize;

use crate::document::APP_NAME;

const INSTALLED_EXE_NAME: &str = "Marlo.exe";
const PROG_ID: &str = "Marlo.md";
const APP_PATHS_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\App Paths\Marlo.exe";
const PROG_ID_KEY: &str = r"Software\Classes\Marlo.md";
const APPLICATION_KEY: &str = r"Software\Classes\Applications\Marlo.exe";
const MD_OPEN_WITH_KEY: &str = r"Software\Classes\.md\OpenWithProgids";
const MARKDOWN_OPEN_WITH_KEY: &str = r"Software\Classes\.markdown\OpenWithProgids";
const MD_CONTEXT_MENU_KEY: &str =
    r"Software\Classes\SystemFileAssociations\.md\shell\OpenWithMarlo";
const MARKDOWN_CONTEXT_MENU_KEY: &str =
    r"Software\Classes\SystemFileAssociations\.markdown\shell\OpenWithMarlo";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatus {
    pub app_name: &'static str,
    pub version: &'static str,
    pub install_path: String,
    pub current_exe_path: String,
    pub installed: bool,
    pub installed_matches_current: bool,
    pub app_path_registered: bool,
    pub file_handlers_registered: bool,
    pub context_menu_registered: bool,
    pub default_apps_uri: &'static str,
    pub message: Option<String>,
}

pub fn setup_status(message: Option<String>) -> Result<SetupStatus, String> {
    let current_exe = current_exe_path()?;
    let install_path = installed_exe_path()?;
    let installed = install_path.exists();

    Ok(SetupStatus {
        app_name: APP_NAME,
        version: env!("CARGO_PKG_VERSION"),
        install_path: path_to_string(&install_path),
        current_exe_path: path_to_string(&current_exe),
        installed,
        installed_matches_current: installed && files_match(&current_exe, &install_path),
        app_path_registered: is_app_path_registered(&install_path),
        file_handlers_registered: are_file_handlers_registered(&install_path),
        context_menu_registered: is_context_menu_registered(&install_path),
        default_apps_uri: "ms-settings:defaultapps",
        message,
    })
}

pub fn install_or_update() -> Result<SetupStatus, String> {
    let current_exe = current_exe_path()?;
    let install_path = installed_exe_path()?;
    let install_dir = install_path.parent().ok_or_else(|| {
        format!(
            "Could not determine install directory for {}",
            install_path.display()
        )
    })?;

    fs::create_dir_all(install_dir).map_err(|error| {
        format!(
            "Could not create install directory {}: {error}",
            install_dir.display()
        )
    })?;

    if !same_path(&current_exe, &install_path) {
        let temp_path = install_path.with_extension("exe.tmp");
        let _ = fs::remove_file(&temp_path);
        fs::copy(&current_exe, &temp_path).map_err(|error| {
            format!(
                "Could not copy {} to {}: {error}",
                current_exe.display(),
                temp_path.display()
            )
        })?;

        if install_path.exists() {
            replace_file(&temp_path, &install_path)?;
        } else {
            fs::rename(&temp_path, &install_path).map_err(|error| {
                let _ = fs::remove_file(&temp_path);
                format!(
                    "Could not move {} to {}: {error}",
                    temp_path.display(),
                    install_path.display()
                )
            })?;
        }
    }

    register_windows_integration(&install_path)?;
    notify_shell_associations_changed();

    setup_status(Some(
        "Marlo is installed and registered as an Open with option for Markdown files.".to_string(),
    ))
}

pub fn remove_integration() -> Result<SetupStatus, String> {
    unregister_windows_integration()?;

    let current_exe = current_exe_path()?;
    let install_path = installed_exe_path()?;
    let mut message = "Marlo registry integration was removed.".to_string();

    if install_path.exists() {
        if same_path(&current_exe, &install_path) {
            message.push_str(&format!(
                " The installed executable is currently running and remains at {}.",
                install_path.display()
            ));
        } else {
            fs::remove_file(&install_path).map_err(|error| {
                format!(
                    "Registry integration was removed, but {} could not be deleted: {error}",
                    install_path.display()
                )
            })?;

            if let Some(install_dir) = install_path.parent() {
                let _ = fs::remove_dir(install_dir);
            }

            message.push_str(" The installed executable was removed.");
        }
    }

    notify_shell_associations_changed();
    setup_status(Some(message))
}

pub fn open_default_apps_settings() -> Result<(), String> {
    Command::new("explorer.exe")
        .arg("ms-settings:defaultapps")
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open Windows Default Apps settings: {error}"))
}

pub fn is_install_mode_arg(arg: &std::ffi::OsStr) -> bool {
    arg == "--install"
}

pub fn first_document_arg(
    args: impl Iterator<Item = std::ffi::OsString>,
) -> Option<std::ffi::OsString> {
    args.filter(|arg| !is_install_mode_arg(arg.as_os_str()))
        .next()
}

fn current_exe_path() -> Result<PathBuf, String> {
    env::current_exe().map_err(|error| format!("Could not determine current executable: {error}"))
}

fn installed_exe_path() -> Result<PathBuf, String> {
    let local_app_data = env::var_os("LOCALAPPDATA").ok_or_else(|| {
        "LOCALAPPDATA is not set; cannot determine per-user install path.".to_string()
    })?;

    Ok(PathBuf::from(local_app_data)
        .join("Programs")
        .join(APP_NAME)
        .join(INSTALLED_EXE_NAME))
}

fn path_to_string(path: &Path) -> String {
    path.display().to_string()
}

fn same_path(left: &Path, right: &Path) -> bool {
    match (left.canonicalize(), right.canonicalize()) {
        (Ok(left), Ok(right)) => left == right,
        _ => left == right,
    }
}

fn files_match(left: &Path, right: &Path) -> bool {
    if same_path(left, right) {
        return true;
    }

    let Ok(left_metadata) = fs::metadata(left) else {
        return false;
    };
    let Ok(right_metadata) = fs::metadata(right) else {
        return false;
    };

    left_metadata.len() == right_metadata.len()
        && fs::read(left)
            .ok()
            .zip(fs::read(right).ok())
            .map_or(false, |(left, right)| left == right)
}

#[cfg(windows)]
fn register_windows_integration(install_path: &Path) -> Result<(), String> {
    use winreg::{
        enums::{HKEY_CURRENT_USER, REG_NONE},
        RegKey, RegValue,
    };

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let install_path_string = path_to_string(install_path);
    let install_dir_string = install_path
        .parent()
        .map(path_to_string)
        .unwrap_or_else(|| install_path_string.clone());
    let command = open_command(install_path);
    let icon = format!("\"{}\",0", install_path.display());

    let (app_paths, _) = hkcu.create_subkey(APP_PATHS_KEY).map_err(registry_error)?;
    app_paths
        .set_value("", &install_path_string)
        .map_err(registry_error)?;
    app_paths
        .set_value("Path", &install_dir_string)
        .map_err(registry_error)?;

    let (prog_id, _) = hkcu.create_subkey(PROG_ID_KEY).map_err(registry_error)?;
    prog_id
        .set_value("", &"Marlo Markdown Document")
        .map_err(registry_error)?;
    let (default_icon, _) = hkcu
        .create_subkey(format!(r"{PROG_ID_KEY}\DefaultIcon"))
        .map_err(registry_error)?;
    default_icon.set_value("", &icon).map_err(registry_error)?;
    let (open_command_key, _) = hkcu
        .create_subkey(format!(r"{PROG_ID_KEY}\shell\open\command"))
        .map_err(registry_error)?;
    open_command_key
        .set_value("", &command)
        .map_err(registry_error)?;

    let (application_command, _) = hkcu
        .create_subkey(format!(r"{APPLICATION_KEY}\shell\open\command"))
        .map_err(registry_error)?;
    application_command
        .set_value("", &command)
        .map_err(registry_error)?;
    let (supported_types, _) = hkcu
        .create_subkey(format!(r"{APPLICATION_KEY}\SupportedTypes"))
        .map_err(registry_error)?;
    supported_types
        .set_value(".md", &"")
        .map_err(registry_error)?;
    supported_types
        .set_value(".markdown", &"")
        .map_err(registry_error)?;

    for key_path in [MD_OPEN_WITH_KEY, MARKDOWN_OPEN_WITH_KEY] {
        let (key, _) = hkcu.create_subkey(key_path).map_err(registry_error)?;
        key.set_raw_value(
            PROG_ID,
            &RegValue {
                vtype: REG_NONE,
                bytes: Vec::new(),
            },
        )
        .map_err(registry_error)?;
    }

    for key_path in [MD_CONTEXT_MENU_KEY, MARKDOWN_CONTEXT_MENU_KEY] {
        let (key, _) = hkcu.create_subkey(key_path).map_err(registry_error)?;
        key.set_value("", &"Open with Marlo")
            .map_err(registry_error)?;
        key.set_value("Icon", &icon).map_err(registry_error)?;
        let (command_key, _) = hkcu
            .create_subkey(format!(r"{key_path}\command"))
            .map_err(registry_error)?;
        command_key
            .set_value("", &command)
            .map_err(registry_error)?;
    }

    Ok(())
}

#[cfg(not(windows))]
fn register_windows_integration(_install_path: &Path) -> Result<(), String> {
    Err("Windows integration is only available on Windows.".to_string())
}

#[cfg(windows)]
fn unregister_windows_integration() -> Result<(), String> {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    for key_path in [
        APP_PATHS_KEY,
        PROG_ID_KEY,
        APPLICATION_KEY,
        MD_CONTEXT_MENU_KEY,
        MARKDOWN_CONTEXT_MENU_KEY,
    ] {
        delete_subkey_all_if_exists(&hkcu, key_path)?;
    }

    for key_path in [MD_OPEN_WITH_KEY, MARKDOWN_OPEN_WITH_KEY] {
        if let Ok(key) = hkcu.open_subkey_with_flags(key_path, winreg::enums::KEY_SET_VALUE) {
            let _ = key.delete_value(PROG_ID);
        }
    }

    Ok(())
}

#[cfg(not(windows))]
fn unregister_windows_integration() -> Result<(), String> {
    Err("Windows integration is only available on Windows.".to_string())
}

#[cfg(windows)]
fn delete_subkey_all_if_exists(parent: &winreg::RegKey, key_path: &str) -> Result<(), String> {
    match parent.delete_subkey_all(key_path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not delete HKCU\\{key_path}: {error}")),
    }
}

#[cfg(windows)]
fn is_app_path_registered(install_path: &Path) -> bool {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    hkcu.open_subkey(APP_PATHS_KEY)
        .and_then(|key| key.get_value::<String, _>(""))
        .map(|value| value.eq_ignore_ascii_case(&path_to_string(install_path)))
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn is_app_path_registered(_install_path: &Path) -> bool {
    false
}

#[cfg(windows)]
fn are_file_handlers_registered(install_path: &Path) -> bool {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let expected_command = open_command(install_path);

    let prog_id_registered = hkcu
        .open_subkey(format!(r"{PROG_ID_KEY}\shell\open\command"))
        .and_then(|key| key.get_value::<String, _>(""))
        .map(|value| value.eq_ignore_ascii_case(&expected_command))
        .unwrap_or(false);

    prog_id_registered
        && has_open_with_progid(&hkcu, MD_OPEN_WITH_KEY)
        && has_open_with_progid(&hkcu, MARKDOWN_OPEN_WITH_KEY)
}

#[cfg(not(windows))]
fn are_file_handlers_registered(_install_path: &Path) -> bool {
    false
}

#[cfg(windows)]
fn has_open_with_progid(hkcu: &winreg::RegKey, key_path: &str) -> bool {
    hkcu.open_subkey(key_path)
        .and_then(|key| key.get_raw_value(PROG_ID))
        .is_ok()
}

#[cfg(windows)]
fn is_context_menu_registered(install_path: &Path) -> bool {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let expected_command = open_command(install_path);

    [MD_CONTEXT_MENU_KEY, MARKDOWN_CONTEXT_MENU_KEY]
        .iter()
        .all(|key_path| {
            hkcu.open_subkey(format!(r"{key_path}\command"))
                .and_then(|key| key.get_value::<String, _>(""))
                .map(|value| value.eq_ignore_ascii_case(&expected_command))
                .unwrap_or(false)
        })
}

#[cfg(not(windows))]
fn is_context_menu_registered(_install_path: &Path) -> bool {
    false
}

#[cfg(windows)]
fn notify_shell_associations_changed() {
    use windows_sys::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};

    unsafe {
        SHChangeNotify(
            SHCNE_ASSOCCHANGED as i32,
            SHCNF_IDLIST,
            std::ptr::null(),
            std::ptr::null(),
        );
    }
}

#[cfg(not(windows))]
fn notify_shell_associations_changed() {}

#[cfg(windows)]
fn registry_error(error: std::io::Error) -> String {
    format!("Could not update the current-user registry: {error}")
}

fn open_command(install_path: &Path) -> String {
    format!("\"{}\" \"%1\"", install_path.display())
}

#[cfg(windows)]
fn replace_file(source: &Path, destination: &Path) -> Result<(), String> {
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let source_wide = path_to_wide(source);
    let destination_wide = path_to_wide(destination);

    let result = unsafe {
        MoveFileExW(
            source_wide.as_ptr(),
            destination_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };

    if result == 0 {
        let error = std::io::Error::last_os_error();
        let _ = fs::remove_file(source);
        return Err(format!(
            "Could not replace {} with {}: {error}",
            destination.display(),
            source.display()
        ));
    }

    Ok(())
}

#[cfg(not(windows))]
fn replace_file(source: &Path, destination: &Path) -> Result<(), String> {
    fs::rename(source, destination).map_err(|error| {
        let _ = fs::remove_file(source);
        format!(
            "Could not replace {} with {}: {error}",
            destination.display(),
            source.display()
        )
    })
}

#[cfg(windows)]
fn path_to_wide(path: &Path) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;

    path.as_os_str().encode_wide().chain(Some(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::{first_document_arg, is_install_mode_arg, open_command};
    use std::{ffi::OsString, path::PathBuf};

    #[test]
    fn detects_install_mode_arg() {
        assert!(is_install_mode_arg("--install".as_ref()));
        assert!(!is_install_mode_arg("notes.md".as_ref()));
    }

    #[test]
    fn first_document_arg_skips_install_flag() {
        let args = vec![OsString::from("--install"), OsString::from("notes.md")];

        assert_eq!(
            first_document_arg(args.into_iter()),
            Some(OsString::from("notes.md"))
        );
    }

    #[test]
    fn open_command_quotes_executable_and_file_placeholder() {
        let command = open_command(&PathBuf::from(r"C:\Users\me\App Data\Marlo.exe"));

        assert_eq!(command, r#""C:\Users\me\App Data\Marlo.exe" "%1""#);
    }
}
