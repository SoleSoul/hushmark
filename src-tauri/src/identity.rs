pub const DISPLAY_NAME: &str = "Hushmark";
pub const DEVELOPER_NAME: &str = "Jonathan Lahav";
pub const RELEASE_EXE_NAME: &str = "hushmark.exe";
pub const INSTALLED_EXE_NAME: &str = "Hushmark.exe";
pub const INSTALL_DIR_NAME: &str = "Hushmark";
pub const PROG_ID: &str = "Hushmark.md";
pub const DOCUMENT_FRIENDLY_NAME: &str = "Hushmark Markdown Document";
pub const APPLICATION_DESCRIPTION: &str = "Read Markdown files with Hushmark.";
pub const CONTEXT_MENU_VERB: &str = "OpenWithHushmark";
pub const CONTEXT_MENU_LABEL: &str = "Open with Hushmark";
pub const REGISTERED_APPLICATIONS_VALUE: &str = DISPLAY_NAME;
pub const REGISTERED_APPLICATIONS_KEY: &str = r"Software\RegisteredApplications";
pub const DEFAULT_APPS_URI: &str = "ms-settings:defaultapps";
pub const MARKDOWN_EXTENSIONS: [&str; 2] = [".md", ".markdown"];

pub fn setup_window_title() -> String {
    format!("{DISPLAY_NAME} Setup")
}

pub fn app_paths_key() -> String {
    format!(r"Software\Microsoft\Windows\CurrentVersion\App Paths\{INSTALLED_EXE_NAME}")
}

pub fn prog_id_key() -> String {
    format!(r"Software\Classes\{PROG_ID}")
}

pub fn application_key() -> String {
    format!(r"Software\Classes\Applications\{INSTALLED_EXE_NAME}")
}

pub fn application_capabilities_key() -> String {
    format!(r"{}\Capabilities", application_key())
}

pub fn application_capabilities_file_associations_key() -> String {
    format!(r"{}\FileAssociations", application_capabilities_key())
}

pub fn open_with_progids_key(extension: &str) -> String {
    format!(r"Software\Classes\{extension}\OpenWithProgids")
}

pub fn context_menu_key(extension: &str) -> String {
    format!(r"Software\Classes\SystemFileAssociations\{extension}\shell\{CONTEXT_MENU_VERB}")
}
