use std::{
    env, fs,
    path::{Path, PathBuf},
};

use serde::Serialize;

use crate::identity::{
    app_paths_key, application_capabilities_file_associations_key, application_capabilities_key,
    application_key, context_menu_key, open_with_progids_key, prog_id_key, APPLICATION_DESCRIPTION,
    CONTEXT_MENU_LABEL, DEFAULT_APPS_URI, DEVELOPER_NAME, DISPLAY_NAME, DOCUMENT_FRIENDLY_NAME,
    INSTALLED_EXE_NAME, INSTALL_DIR_NAME, MARKDOWN_EXTENSIONS, PROG_ID,
    REGISTERED_APPLICATIONS_KEY, REGISTERED_APPLICATIONS_VALUE,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupMessage {
    pub kind: &'static str,
    pub text: String,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatus {
    pub app_name: &'static str,
    pub version: &'static str,
    pub installed_version: Option<String>,
    pub developer: &'static str,
    pub platform: &'static str,
    pub setup_supported: bool,
    pub release_exe_name: &'static str,
    pub installed_exe_name: &'static str,
    pub prog_id: &'static str,
    pub install_path: String,
    pub current_exe_path: String,
    pub installed: bool,
    pub installed_matches_current: bool,
    pub app_path_registered: bool,
    pub application_registered: bool,
    pub file_handlers_registered: bool,
    pub open_with_md_registered: bool,
    pub open_with_markdown_registered: bool,
    pub context_menu_registered: bool,
    pub context_menu_md_registered: bool,
    pub context_menu_markdown_registered: bool,
    pub default_apps_uri: &'static str,
    pub message: Option<SetupMessage>,
}

impl SetupMessage {
    fn success(text: impl Into<String>) -> Self {
        Self {
            kind: "success",
            text: text.into(),
            details: None,
        }
    }

    fn success_with_details(text: impl Into<String>, details: impl Into<String>) -> Self {
        Self {
            kind: "success",
            text: text.into(),
            details: Some(details.into()),
        }
    }

    fn warning(text: impl Into<String>, details: Option<String>) -> Self {
        Self {
            kind: "warning",
            text: text.into(),
            details,
        }
    }

    fn error(text: impl Into<String>, details: impl Into<String>) -> Self {
        Self {
            kind: "error",
            text: text.into(),
            details: Some(details.into()),
        }
    }
}

#[cfg(windows)]
pub fn setup_status(message: Option<SetupMessage>) -> Result<SetupStatus, String> {
    let current_exe = current_exe_path()?;
    let install_path = installed_exe_path()?;
    let installed = install_path.exists();
    let installed_matches_current = installed && files_match(&current_exe, &install_path);
    let installed_version = if installed && !installed_matches_current {
        installed_version_for_status(
            installed,
            installed_matches_current,
            executable_version(&install_path),
        )
    } else {
        None
    };
    let app_path_registered = is_app_path_registered(&install_path);
    let application_registered = is_application_registered(&install_path);
    let open_with_md_registered = is_open_with_extension_registered(MARKDOWN_EXTENSIONS[0]);
    let open_with_markdown_registered = is_open_with_extension_registered(MARKDOWN_EXTENSIONS[1]);
    let context_menu_md_registered =
        is_context_menu_extension_registered(MARKDOWN_EXTENSIONS[0], &install_path);
    let context_menu_markdown_registered =
        is_context_menu_extension_registered(MARKDOWN_EXTENSIONS[1], &install_path);

    Ok(SetupStatus {
        app_name: DISPLAY_NAME,
        version: env!("CARGO_PKG_VERSION"),
        installed_version,
        developer: DEVELOPER_NAME,
        platform: std::env::consts::OS,
        setup_supported: true,
        release_exe_name: crate::identity::RELEASE_EXE_NAME,
        installed_exe_name: INSTALLED_EXE_NAME,
        prog_id: PROG_ID,
        install_path: path_to_string(&install_path),
        current_exe_path: path_to_string(&current_exe),
        installed,
        installed_matches_current,
        app_path_registered,
        application_registered,
        file_handlers_registered: are_file_handlers_registered(
            installed,
            app_path_registered,
            application_registered,
            open_with_md_registered,
            open_with_markdown_registered,
        ),
        open_with_md_registered,
        open_with_markdown_registered,
        context_menu_registered: is_context_menu_registered(
            installed,
            context_menu_md_registered,
            context_menu_markdown_registered,
        ),
        context_menu_md_registered,
        context_menu_markdown_registered,
        default_apps_uri: DEFAULT_APPS_URI,
        message,
    })
}

#[cfg(not(windows))]
pub fn setup_status(message: Option<SetupMessage>) -> Result<SetupStatus, String> {
    let current_exe_path = current_exe_path()
        .map(|path| path_to_string(&path))
        .unwrap_or_else(|error| format!("Unavailable: {error}"));

    Ok(SetupStatus {
        app_name: DISPLAY_NAME,
        version: env!("CARGO_PKG_VERSION"),
        installed_version: None,
        developer: DEVELOPER_NAME,
        platform: std::env::consts::OS,
        setup_supported: false,
        release_exe_name: crate::identity::RELEASE_EXE_NAME,
        installed_exe_name: INSTALLED_EXE_NAME,
        prog_id: PROG_ID,
        install_path: "Not available on this platform.".to_string(),
        current_exe_path,
        installed: false,
        installed_matches_current: false,
        app_path_registered: false,
        application_registered: false,
        file_handlers_registered: false,
        open_with_md_registered: false,
        open_with_markdown_registered: false,
        context_menu_registered: false,
        context_menu_md_registered: false,
        context_menu_markdown_registered: false,
        default_apps_uri: "",
        message: message.or_else(|| Some(setup_not_supported_message())),
    })
}

#[cfg(not(windows))]
fn setup_not_supported_message() -> SetupMessage {
    SetupMessage::warning(
        "Setup integration is currently only available on Windows.",
        Some("Linux desktop integration is planned, but it is not implemented yet.".to_string()),
    )
}

fn are_file_handlers_registered(
    installed: bool,
    app_path_registered: bool,
    application_registered: bool,
    open_with_md_registered: bool,
    open_with_markdown_registered: bool,
) -> bool {
    installed
        && app_path_registered
        && application_registered
        && open_with_md_registered
        && open_with_markdown_registered
}

fn is_context_menu_registered(
    installed: bool,
    context_menu_md_registered: bool,
    context_menu_markdown_registered: bool,
) -> bool {
    installed && context_menu_md_registered && context_menu_markdown_registered
}

fn installed_version_for_status(
    installed: bool,
    installed_matches_current: bool,
    version: Option<String>,
) -> Option<String> {
    if installed && !installed_matches_current {
        Some(version.unwrap_or_else(|| "Unknown".to_string()))
    } else {
        None
    }
}

#[cfg(windows)]
pub fn install_hushmark() -> Result<SetupStatus, String> {
    match install_current_exe() {
        Ok(()) => setup_status(Some(SetupMessage::success(format!(
            "{DISPLAY_NAME} was installed."
        )))),
        Err(error) => setup_status(Some(SetupMessage::error(
            format!("{DISPLAY_NAME} could not be installed."),
            error,
        ))),
    }
}

#[cfg(not(windows))]
pub fn install_hushmark() -> Result<SetupStatus, String> {
    setup_status(Some(setup_not_supported_message()))
}

#[cfg(windows)]
pub fn toggle_install() -> Result<SetupStatus, String> {
    let status = setup_status(None)?;

    if status.installed_matches_current {
        let mut errors = Vec::new();
        if let Err(error) = unregister_open_with_integration() {
            errors.push(error);
        }
        if let Err(error) = unregister_context_menu_integration() {
            errors.push(error);
        }

        let mut message = remove_installed_exe()?;
        notify_shell_associations_changed();

        if !errors.is_empty() {
            return setup_status(Some(SetupMessage::error(
                "Some Hushmark integration could not be removed.",
                errors.join("\n"),
            )));
        }

        if message.kind == "success" {
            append_message_details(
                &mut message,
                "Open With support and right-click entries were removed because they need the installed copy.",
            );
        }

        setup_status(Some(message))
    } else {
        install_hushmark()
    }
}

#[cfg(not(windows))]
pub fn toggle_install() -> Result<SetupStatus, String> {
    setup_status(Some(setup_not_supported_message()))
}

#[cfg(windows)]
pub fn toggle_open_with_support() -> Result<SetupStatus, String> {
    let status = setup_status(None)?;

    if status.file_handlers_registered {
        match unregister_open_with_integration() {
            Ok(()) => {
                notify_shell_associations_changed();
                setup_status(Some(SetupMessage::success(
                    "Open With support was removed.",
                )))
            }
            Err(error) => setup_status(Some(SetupMessage::error(
                "Open With support could not be removed.",
                error,
            ))),
        }
    } else {
        let installed_first = !status.installed_matches_current;
        match install_current_exe().and_then(|_| {
            let install_path = installed_exe_path()?;
            register_open_with_integration(&install_path)
        }) {
            Ok(()) => {
                notify_shell_associations_changed();
                let text = if installed_first {
                    format!("{DISPLAY_NAME} was installed and Open With support was added.")
                } else {
                    "Open With support was added.".to_string()
                };
                setup_status(Some(SetupMessage::success(text)))
            }
            Err(error) => setup_status(Some(SetupMessage::error(
                "Open With support could not be added.",
                error,
            ))),
        }
    }
}

#[cfg(not(windows))]
pub fn toggle_open_with_support() -> Result<SetupStatus, String> {
    setup_status(Some(setup_not_supported_message()))
}

#[cfg(windows)]
pub fn toggle_context_menu() -> Result<SetupStatus, String> {
    let status = setup_status(None)?;

    if status.context_menu_registered {
        match unregister_context_menu_integration() {
            Ok(()) => {
                notify_shell_associations_changed();
                setup_status(Some(SetupMessage::success(
                    "Right-click menu entry was removed.",
                )))
            }
            Err(error) => setup_status(Some(SetupMessage::error(
                "Right-click menu entry could not be removed.",
                error,
            ))),
        }
    } else {
        let installed_first = !status.installed_matches_current;
        match install_current_exe().and_then(|_| {
            let install_path = installed_exe_path()?;
            register_context_menu_integration(&install_path)
        }) {
            Ok(()) => {
                notify_shell_associations_changed();
                let text = if installed_first {
                    format!(
                        "{DISPLAY_NAME} was installed and the right-click menu entry was added."
                    )
                } else {
                    "Right-click menu entry was added.".to_string()
                };
                setup_status(Some(SetupMessage::success(text)))
            }
            Err(error) => setup_status(Some(SetupMessage::error(
                "Right-click menu entry could not be added.",
                error,
            ))),
        }
    }
}

#[cfg(not(windows))]
pub fn toggle_context_menu() -> Result<SetupStatus, String> {
    setup_status(Some(setup_not_supported_message()))
}

#[cfg(windows)]
pub fn remove_all_integration() -> Result<SetupStatus, String> {
    let mut errors = Vec::new();

    if let Err(error) = unregister_open_with_integration() {
        errors.push(error);
    }

    if let Err(error) = unregister_context_menu_integration() {
        errors.push(error);
    }

    let install_message = remove_installed_exe()?;
    notify_shell_associations_changed();

    if !errors.is_empty() {
        return setup_status(Some(SetupMessage::error(
            "Some Hushmark integration could not be removed.",
            errors.join("\n"),
        )));
    }

    if install_message.kind == "warning" {
        return setup_status(Some(install_message));
    }

    setup_status(Some(SetupMessage::success(
        "All Hushmark integration was removed.",
    )))
}

#[cfg(not(windows))]
pub fn remove_all_integration() -> Result<SetupStatus, String> {
    setup_status(Some(setup_not_supported_message()))
}

#[cfg(windows)]
pub fn open_default_apps_settings() -> Result<SetupStatus, String> {
    match open_default_apps_settings_impl() {
        Ok(()) => setup_status(Some(SetupMessage::success_with_details(
            "Windows Default Apps settings opened.",
            "Choose Hushmark manually if you want it as the default for Markdown files.",
        ))),
        Err(error) => setup_status(Some(SetupMessage::warning(
            "Windows did not open Default Apps automatically.",
            Some(format!(
                "You can still choose Hushmark manually in Windows Settings > Apps > Default apps.\n\nTechnical error: {error}"
            )),
        ))),
    }
}

#[cfg(not(windows))]
pub fn open_default_apps_settings() -> Result<SetupStatus, String> {
    setup_status(Some(setup_not_supported_message()))
}

fn append_message_details(message: &mut SetupMessage, details: &str) {
    if let Some(existing_details) = &mut message.details {
        existing_details.push('\n');
        existing_details.push_str(details);
    } else {
        message.details = Some(details.to_string());
    }
}

pub fn is_setup_mode_arg(arg: &std::ffi::OsStr) -> bool {
    arg == "--setup"
}

pub fn first_document_arg(
    args: impl Iterator<Item = std::ffi::OsString>,
) -> Option<std::ffi::OsString> {
    args.filter(|arg| !is_setup_mode_arg(arg.as_os_str()))
        .next()
}

fn current_exe_path() -> Result<PathBuf, String> {
    env::current_exe().map_err(|error| format!("Could not determine current executable: {error}"))
}

#[cfg(windows)]
fn installed_exe_path() -> Result<PathBuf, String> {
    let local_app_data = env::var_os("LOCALAPPDATA").ok_or_else(|| {
        "LOCALAPPDATA is not set; cannot determine per-user install path.".to_string()
    })?;

    Ok(PathBuf::from(local_app_data)
        .join("Programs")
        .join(INSTALL_DIR_NAME)
        .join(INSTALLED_EXE_NAME))
}

fn path_to_string(path: &Path) -> String {
    path.display().to_string()
}

#[cfg(windows)]
fn executable_version(path: &Path) -> Option<String> {
    use windows_sys::Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW};

    let path = path_to_wide(path);
    let mut handle = 0;
    let size = unsafe { GetFileVersionInfoSizeW(path.as_ptr(), &mut handle) };
    if size == 0 {
        return None;
    }

    let mut data = vec![0_u8; size as usize];
    let info_read =
        unsafe { GetFileVersionInfoW(path.as_ptr(), 0, size, data.as_mut_ptr().cast()) };
    if info_read == 0 {
        return None;
    }

    query_version_string(&data, "ProductVersion")
        .or_else(|| query_version_string(&data, "FileVersion"))
        .or_else(|| query_fixed_file_version(&data))
}

#[cfg(not(windows))]
fn executable_version(_path: &Path) -> Option<String> {
    None
}

#[cfg(windows)]
fn query_version_string(data: &[u8], field_name: &str) -> Option<String> {
    let mut translations = query_version_translations(data);
    if translations.is_empty() {
        translations.push((0x0409, 1200));
        translations.push((0x0409, 1252));
    }

    translations
        .into_iter()
        .find_map(|(language, code_page)| {
            let sub_block = format!(r"\StringFileInfo\{language:04x}{code_page:04x}\{field_name}");
            query_wide_version_value(data, &sub_block)
        })
        .map(|version| version.trim().to_string())
        .filter(|version| !version.is_empty())
}

#[cfg(windows)]
fn query_version_translations(data: &[u8]) -> Vec<(u16, u16)> {
    use std::{ffi::c_void, mem, ptr, slice};
    use windows_sys::Win32::Storage::FileSystem::VerQueryValueW;

    let sub_block = wide_null(r"\VarFileInfo\Translation");
    let mut buffer: *mut c_void = ptr::null_mut();
    let mut length = 0;
    let found = unsafe {
        VerQueryValueW(
            data.as_ptr().cast(),
            sub_block.as_ptr(),
            &mut buffer,
            &mut length,
        )
    };

    if found == 0 || buffer.is_null() || length < 4 {
        return Vec::new();
    }

    let words = unsafe {
        slice::from_raw_parts(
            buffer.cast::<u16>(),
            length as usize / mem::size_of::<u16>(),
        )
    };
    words
        .chunks_exact(2)
        .map(|translation| (translation[0], translation[1]))
        .collect()
}

#[cfg(windows)]
fn query_wide_version_value(data: &[u8], sub_block: &str) -> Option<String> {
    use std::{ffi::c_void, ptr, slice};
    use windows_sys::Win32::Storage::FileSystem::VerQueryValueW;

    let sub_block = wide_null(sub_block);
    let mut buffer: *mut c_void = ptr::null_mut();
    let mut length = 0;
    let found = unsafe {
        VerQueryValueW(
            data.as_ptr().cast(),
            sub_block.as_ptr(),
            &mut buffer,
            &mut length,
        )
    };

    if found == 0 || buffer.is_null() || length == 0 {
        return None;
    }

    let value = unsafe { slice::from_raw_parts(buffer.cast::<u16>(), length as usize) };
    let value_end = value
        .iter()
        .position(|character| *character == 0)
        .unwrap_or(value.len());

    String::from_utf16(&value[..value_end]).ok()
}

#[cfg(windows)]
fn query_fixed_file_version(data: &[u8]) -> Option<String> {
    use std::{ffi::c_void, mem, ptr};
    use windows_sys::Win32::Storage::FileSystem::{VerQueryValueW, VS_FIXEDFILEINFO};

    let sub_block = wide_null(r"\");
    let mut buffer: *mut c_void = ptr::null_mut();
    let mut length = 0;
    let found = unsafe {
        VerQueryValueW(
            data.as_ptr().cast(),
            sub_block.as_ptr(),
            &mut buffer,
            &mut length,
        )
    };

    if found == 0 || buffer.is_null() || length as usize != mem::size_of::<VS_FIXEDFILEINFO>() {
        return None;
    }

    let info = unsafe { &*buffer.cast::<VS_FIXEDFILEINFO>() };
    if info.dwSignature != 0xfeef04bd {
        return None;
    }

    let mut parts = vec![
        high_word(info.dwFileVersionMS),
        low_word(info.dwFileVersionMS),
        high_word(info.dwFileVersionLS),
        low_word(info.dwFileVersionLS),
    ];
    while parts.len() > 3 && parts.last() == Some(&0) {
        parts.pop();
    }

    Some(
        parts
            .into_iter()
            .map(|part| part.to_string())
            .collect::<Vec<_>>()
            .join("."),
    )
}

#[cfg(windows)]
fn high_word(value: u32) -> u16 {
    (value >> 16) as u16
}

#[cfg(windows)]
fn low_word(value: u32) -> u16 {
    value as u16
}

#[cfg(windows)]
fn same_path(left: &Path, right: &Path) -> bool {
    match (left.canonicalize(), right.canonicalize()) {
        (Ok(left), Ok(right)) => paths_equal(&left, &right),
        _ => paths_equal(left, right),
    }
}

#[cfg(windows)]
fn paths_equal(left: &Path, right: &Path) -> bool {
    left.as_os_str()
        .to_string_lossy()
        .eq_ignore_ascii_case(&right.as_os_str().to_string_lossy())
}

#[cfg(windows)]
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
fn install_current_exe() -> Result<(), String> {
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

    if same_path(&current_exe, &install_path) {
        return Ok(());
    }

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
        replace_file(&temp_path, &install_path)
    } else {
        fs::rename(&temp_path, &install_path).map_err(|error| {
            let _ = fs::remove_file(&temp_path);
            format!(
                "Could not move {} to {}: {error}",
                temp_path.display(),
                install_path.display()
            )
        })
    }
}

#[cfg(windows)]
fn remove_installed_exe() -> Result<SetupMessage, String> {
    let current_exe = current_exe_path()?;
    let install_path = installed_exe_path()?;

    if !install_path.exists() {
        return Ok(SetupMessage::success(format!(
            "{DISPLAY_NAME} is not installed."
        )));
    }

    if same_path(&current_exe, &install_path) {
        return Ok(SetupMessage::warning(
            "The installed executable could not be removed because it is currently running.",
            Some(format!(
                "The running executable is {}. Close {DISPLAY_NAME}, then delete {} manually if you want to remove the installed copy.",
                current_exe.display(),
                install_path.display()
            )),
        ));
    }

    match fs::remove_file(&install_path) {
        Ok(()) => {
            if let Some(note) = remove_empty_install_dir(&install_path) {
                Ok(SetupMessage::success_with_details(
                    format!("{DISPLAY_NAME} was uninstalled."),
                    note,
                ))
            } else {
                Ok(SetupMessage::success(format!(
                    "{DISPLAY_NAME} was uninstalled."
                )))
            }
        }
        Err(error) => Ok(SetupMessage::warning(
            "The installed executable could not be removed because it is currently running.",
            Some(format!(
                "Could not delete {}: {error}",
                install_path.display()
            )),
        )),
    }
}

#[cfg(windows)]
fn remove_empty_install_dir(install_path: &Path) -> Option<String> {
    let install_dir = install_path.parent()?;

    match fs::remove_dir(install_dir) {
        Ok(()) => Some("The empty install directory was removed.".to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) if error.kind() == std::io::ErrorKind::DirectoryNotEmpty => Some(format!(
            "The install directory {} contains other files and was left in place.",
            install_dir.display()
        )),
        Err(error) => Some(format!(
            "The install directory {} could not be removed: {error}",
            install_dir.display()
        )),
    }
}

#[cfg(windows)]
fn register_open_with_integration(install_path: &Path) -> Result<(), String> {
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

    let app_paths_key = app_paths_key();
    let prog_id_key = prog_id_key();
    let application_key = application_key();
    let capabilities_key = application_capabilities_key();
    let file_associations_key = application_capabilities_file_associations_key();

    let (app_paths, _) = hkcu.create_subkey(&app_paths_key).map_err(registry_error)?;
    app_paths
        .set_value("", &install_path_string)
        .map_err(registry_error)?;
    app_paths
        .set_value("Path", &install_dir_string)
        .map_err(registry_error)?;

    let (prog_id, _) = hkcu.create_subkey(&prog_id_key).map_err(registry_error)?;
    prog_id
        .set_value("", &DOCUMENT_FRIENDLY_NAME)
        .map_err(registry_error)?;
    let (default_icon, _) = hkcu
        .create_subkey(format!(r"{prog_id_key}\DefaultIcon"))
        .map_err(registry_error)?;
    default_icon.set_value("", &icon).map_err(registry_error)?;
    let (open_command_key, _) = hkcu
        .create_subkey(format!(r"{prog_id_key}\shell\open\command"))
        .map_err(registry_error)?;
    open_command_key
        .set_value("", &command)
        .map_err(registry_error)?;

    let (application_command, _) = hkcu
        .create_subkey(format!(r"{application_key}\shell\open\command"))
        .map_err(registry_error)?;
    application_command
        .set_value("", &command)
        .map_err(registry_error)?;
    let (supported_types, _) = hkcu
        .create_subkey(format!(r"{application_key}\SupportedTypes"))
        .map_err(registry_error)?;
    let (capabilities, _) = hkcu
        .create_subkey(&capabilities_key)
        .map_err(registry_error)?;
    capabilities
        .set_value("ApplicationName", &DISPLAY_NAME)
        .map_err(registry_error)?;
    capabilities
        .set_value("ApplicationDescription", &APPLICATION_DESCRIPTION)
        .map_err(registry_error)?;
    capabilities
        .set_value("ApplicationIcon", &icon)
        .map_err(registry_error)?;
    let (file_associations, _) = hkcu
        .create_subkey(&file_associations_key)
        .map_err(registry_error)?;

    for extension in MARKDOWN_EXTENSIONS {
        supported_types
            .set_value(extension, &"")
            .map_err(registry_error)?;
        file_associations
            .set_value(extension, &PROG_ID)
            .map_err(registry_error)?;
    }

    let (registered_applications, _) = hkcu
        .create_subkey(REGISTERED_APPLICATIONS_KEY)
        .map_err(registry_error)?;
    registered_applications
        .set_value(REGISTERED_APPLICATIONS_VALUE, &capabilities_key)
        .map_err(registry_error)?;

    for extension in MARKDOWN_EXTENSIONS {
        let open_with_key = open_with_progids_key(extension);
        let (key, _) = hkcu.create_subkey(&open_with_key).map_err(registry_error)?;
        key.set_raw_value(
            PROG_ID,
            &RegValue {
                vtype: REG_NONE,
                bytes: Vec::new(),
            },
        )
        .map_err(registry_error)?;
    }

    Ok(())
}

#[cfg(not(windows))]
fn register_open_with_integration(_install_path: &Path) -> Result<(), String> {
    Err("Windows integration is only available on Windows.".to_string())
}

#[cfg(windows)]
fn unregister_open_with_integration() -> Result<(), String> {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    for key_path in [app_paths_key(), prog_id_key(), application_key()] {
        delete_subkey_all_if_exists(&hkcu, &key_path)?;
    }

    for extension in MARKDOWN_EXTENSIONS {
        let key_path = open_with_progids_key(extension);
        if let Ok(key) = hkcu.open_subkey_with_flags(&key_path, winreg::enums::KEY_SET_VALUE) {
            let _ = key.delete_value(PROG_ID);
        }
    }

    if let Ok(key) =
        hkcu.open_subkey_with_flags(REGISTERED_APPLICATIONS_KEY, winreg::enums::KEY_SET_VALUE)
    {
        let _ = key.delete_value(REGISTERED_APPLICATIONS_VALUE);
    }

    Ok(())
}

#[cfg(not(windows))]
fn unregister_open_with_integration() -> Result<(), String> {
    Err("Windows integration is only available on Windows.".to_string())
}

#[cfg(windows)]
fn register_context_menu_integration(install_path: &Path) -> Result<(), String> {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let command = open_command(install_path);
    let icon = format!("\"{}\",0", install_path.display());

    for extension in MARKDOWN_EXTENSIONS {
        let key_path = context_menu_key(extension);
        let (key, _) = hkcu.create_subkey(&key_path).map_err(registry_error)?;
        key.set_value("", &CONTEXT_MENU_LABEL)
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
fn register_context_menu_integration(_install_path: &Path) -> Result<(), String> {
    Err("Windows integration is only available on Windows.".to_string())
}

#[cfg(windows)]
fn unregister_context_menu_integration() -> Result<(), String> {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    for extension in MARKDOWN_EXTENSIONS {
        let key_path = context_menu_key(extension);
        delete_subkey_all_if_exists(&hkcu, &key_path)?;
    }

    Ok(())
}

#[cfg(not(windows))]
fn unregister_context_menu_integration() -> Result<(), String> {
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
    hkcu.open_subkey(app_paths_key())
        .and_then(|key| key.get_value::<String, _>(""))
        .map(|value| same_path(Path::new(&value), install_path))
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn is_app_path_registered(_install_path: &Path) -> bool {
    false
}

#[cfg(windows)]
fn is_application_registered(install_path: &Path) -> bool {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let expected_command = open_command(install_path);
    let prog_id_key = prog_id_key();
    let application_key = application_key();
    let file_associations_key = application_capabilities_file_associations_key();

    let prog_id_registered = hkcu
        .open_subkey(format!(r"{prog_id_key}\shell\open\command"))
        .and_then(|key| key.get_value::<String, _>(""))
        .map(|value| value.eq_ignore_ascii_case(&expected_command))
        .unwrap_or(false);

    let application_command_registered = hkcu
        .open_subkey(format!(r"{application_key}\shell\open\command"))
        .and_then(|key| key.get_value::<String, _>(""))
        .map(|value| value.eq_ignore_ascii_case(&expected_command))
        .unwrap_or(false);

    let registered_application = hkcu
        .open_subkey(REGISTERED_APPLICATIONS_KEY)
        .and_then(|key| key.get_value::<String, _>(REGISTERED_APPLICATIONS_VALUE))
        .map(|value| value == application_capabilities_key())
        .unwrap_or(false);

    let file_associations_registered = hkcu
        .open_subkey(file_associations_key)
        .map(|key| {
            MARKDOWN_EXTENSIONS.iter().all(|extension| {
                key.get_value::<String, _>(extension)
                    .map(|value| value == PROG_ID)
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false);

    prog_id_registered
        && application_command_registered
        && registered_application
        && file_associations_registered
}

#[cfg(not(windows))]
fn is_application_registered(_install_path: &Path) -> bool {
    false
}

#[cfg(windows)]
fn is_open_with_extension_registered(extension: &str) -> bool {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key_path = open_with_progids_key(extension);
    hkcu.open_subkey(key_path)
        .and_then(|key| key.get_raw_value(PROG_ID))
        .is_ok()
}

#[cfg(not(windows))]
fn is_open_with_extension_registered(_extension: &str) -> bool {
    false
}

#[cfg(windows)]
fn is_context_menu_extension_registered(extension: &str, install_path: &Path) -> bool {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let expected_command = open_command(install_path);
    let key_path = context_menu_key(extension);

    hkcu.open_subkey(format!(r"{key_path}\command"))
        .and_then(|key| key.get_value::<String, _>(""))
        .map(|value| value.eq_ignore_ascii_case(&expected_command))
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn is_context_menu_extension_registered(_extension: &str, _install_path: &Path) -> bool {
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
fn open_default_apps_settings_impl() -> Result<(), String> {
    use windows_sys::Win32::UI::Shell::ShellExecuteW;

    let operation = wide_null("open");
    let uri = wide_null(DEFAULT_APPS_URI);
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            operation.as_ptr(),
            uri.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            1,
        )
    } as isize;

    if result > 32 {
        Ok(())
    } else {
        Err(format!(
            "ShellExecuteW returned {result} for {DEFAULT_APPS_URI}. Last OS error: {}",
            std::io::Error::last_os_error()
        ))
    }
}

#[cfg(not(windows))]
fn open_default_apps_settings_impl() -> Result<(), String> {
    Err("Windows Default Apps settings are only available on Windows.".to_string())
}

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

#[cfg(windows)]
fn path_to_wide(path: &Path) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;

    path.as_os_str().encode_wide().chain(Some(0)).collect()
}

#[cfg(windows)]
fn wide_null(value: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;

    std::ffi::OsStr::new(value)
        .encode_wide()
        .chain(Some(0))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{
        are_file_handlers_registered, first_document_arg, installed_version_for_status,
        is_context_menu_registered, is_setup_mode_arg, open_command,
    };
    use std::{ffi::OsString, path::PathBuf};

    #[test]
    fn detects_setup_mode_arg() {
        assert!(is_setup_mode_arg("--setup".as_ref()));
        assert!(!is_setup_mode_arg("--install".as_ref()));
        assert!(!is_setup_mode_arg("notes.md".as_ref()));
    }

    #[test]
    fn first_document_arg_skips_setup_flag() {
        let args = vec![OsString::from("--setup"), OsString::from("notes.md")];

        assert_eq!(
            first_document_arg(args.into_iter()),
            Some(OsString::from("notes.md"))
        );
    }

    #[test]
    fn open_command_quotes_executable_and_file_placeholder() {
        let command = open_command(&PathBuf::from(r"C:\Users\me\App Data\Hushmark.exe"));

        assert_eq!(command, r#""C:\Users\me\App Data\Hushmark.exe" "%1""#);
    }

    #[test]
    fn file_handlers_can_be_registered_for_an_installed_copy_that_needs_update() {
        assert!(are_file_handlers_registered(true, true, true, true, true));
        assert!(!are_file_handlers_registered(false, true, true, true, true));
        assert!(!are_file_handlers_registered(true, true, true, true, false));
    }

    #[test]
    fn context_menu_can_be_registered_for_an_installed_copy_that_needs_update() {
        assert!(is_context_menu_registered(true, true, true));
        assert!(!is_context_menu_registered(false, true, true));
        assert!(!is_context_menu_registered(true, true, false));
    }

    #[test]
    fn installed_version_is_hidden_when_no_update_is_available() {
        assert_eq!(
            installed_version_for_status(false, false, Some("0.1.0".to_string())),
            None
        );
        assert_eq!(
            installed_version_for_status(true, true, Some("0.1.0".to_string())),
            None
        );
    }

    #[test]
    fn installed_version_is_shown_when_update_is_available() {
        assert_eq!(
            installed_version_for_status(true, false, Some("0.1.0".to_string())),
            Some("0.1.0".to_string())
        );
    }

    #[test]
    fn installed_version_is_unknown_when_update_is_available_but_version_is_unreadable() {
        assert_eq!(
            installed_version_for_status(true, false, None),
            Some("Unknown".to_string())
        );
    }

    #[test]
    fn executable_version_is_missing_for_a_missing_file() {
        assert_eq!(
            super::executable_version(&PathBuf::from(r"C:\definitely\missing\Hushmark.exe")),
            None
        );
    }
}
