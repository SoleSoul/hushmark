mod document;
mod document_parts;
mod external_links;
mod identity;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(windows)]
mod setup;
mod startup;

use std::path::PathBuf;

use document::{
    load_dropped_markdown_file, load_initial_document_from_arg, load_linked_markdown_file,
    LinkedDocument, LoadedDocument,
};
use serde::Serialize;
#[cfg(windows)]
use setup::{
    remove_all_integration as remove_all_app_integration, setup_status,
    toggle_context_menu as toggle_app_context_menu, toggle_install as toggle_app_install,
    toggle_open_with_support as toggle_app_open_with_support, SetupActionResult, SetupStatus,
};
use startup::first_document_arg;
use tauri_plugin_opener::OpenerExt;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PlatformCapabilities {
    setup: bool,
}

impl PlatformCapabilities {
    fn current() -> Self {
        Self {
            setup: cfg!(windows),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StartupView {
    platform: &'static str,
    document: Option<LoadedDocument>,
    capabilities: PlatformCapabilities,
}

#[tauri::command]
fn load_initial_view(window: tauri::Window) -> Result<StartupView, String> {
    let document = load_initial_document_from_arg(first_document_arg(std::env::args_os().skip(1)));
    set_window_title(&window, &document);

    Ok(StartupView {
        platform: std::env::consts::OS,
        document: Some(document),
        capabilities: PlatformCapabilities::current(),
    })
}

#[tauri::command]
fn load_dropped_document(path: String, window: tauri::Window) -> LoadedDocument {
    let document = load_dropped_markdown_file(PathBuf::from(path));
    set_window_title(&window, &document);

    document
}

#[tauri::command]
fn load_linked_document(
    current_path: String,
    navigation_root: String,
    href: String,
    window: tauri::Window,
) -> LinkedDocument {
    let linked_document = load_linked_markdown_file(
        PathBuf::from(current_path),
        PathBuf::from(navigation_root),
        href,
    );

    if linked_document.document.error.is_none() {
        set_window_title(&window, &linked_document.document);
    }

    linked_document
}

#[cfg(windows)]
#[tauri::command]
fn get_setup_status() -> Result<SetupStatus, String> {
    setup_status(None)
}

#[cfg(windows)]
#[tauri::command]
fn toggle_install(app: tauri::AppHandle) -> Result<SetupStatus, String> {
    finish_setup_action(toggle_app_install()?, app)
}

#[cfg(windows)]
#[tauri::command]
fn toggle_open_with_support() -> Result<SetupStatus, String> {
    toggle_app_open_with_support()
}

#[cfg(windows)]
#[tauri::command]
fn toggle_context_menu() -> Result<SetupStatus, String> {
    toggle_app_context_menu()
}

#[cfg(windows)]
#[tauri::command]
fn remove_all_integration(app: tauri::AppHandle) -> Result<SetupStatus, String> {
    finish_setup_action(remove_all_app_integration()?, app)
}

#[cfg(windows)]
fn finish_setup_action(
    result: SetupActionResult,
    app: tauri::AppHandle,
) -> Result<SetupStatus, String> {
    if result.exit_required {
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(150));
            app.exit(0);
        });
    }

    Ok(result.status)
}

#[tauri::command]
fn open_external_link(url: String, app: tauri::AppHandle) -> Result<(), String> {
    let url = external_links::allowed_external_url(&url)?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| format!("Could not open external link: {error}"))
}

fn set_window_title(window: &tauri::Window, document: &LoadedDocument) {
    #[cfg(target_os = "macos")]
    let title = macos::title_for(document);
    #[cfg(not(target_os = "macos"))]
    let title = default_window_title(document);

    if let Err(error) = window.set_title(&title) {
        eprintln!("failed to set window title: {error}");
    }
}

#[cfg(not(target_os = "macos"))]
fn default_window_title(document: &LoadedDocument) -> String {
    use identity::DISPLAY_NAME;

    match (&document.file_name, &document.error) {
        (Some(file_name), Some(_)) => format!("Error: {file_name} - {DISPLAY_NAME}"),
        (Some(file_name), None) => format!("{file_name} - {DISPLAY_NAME}"),
        (None, Some(_)) => format!("Error - {DISPLAY_NAME}"),
        (None, None) => DISPLAY_NAME.to_string(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(target_os = "macos")]
    let builder = macos::configure(builder);

    #[cfg(windows)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        load_initial_view,
        load_dropped_document,
        load_linked_document,
        get_setup_status,
        toggle_install,
        toggle_open_with_support,
        toggle_context_menu,
        remove_all_integration,
        open_external_link
    ]);

    #[cfg(all(not(windows), not(target_os = "macos")))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        load_initial_view,
        load_dropped_document,
        load_linked_document,
        open_external_link
    ]);

    #[cfg(target_os = "macos")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        load_initial_view,
        load_dropped_document,
        load_linked_document,
        open_external_link,
        macos::macos_frontend_ready,
        macos::print_macos_document,
        macos::update_macos_menu_state
    ]);

    #[cfg(target_os = "macos")]
    {
        let app = builder
            .build(tauri::generate_context!())
            .expect("error while building tauri application");
        app.run(macos::handle_run_event);
    }

    #[cfg(not(target_os = "macos"))]
    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod capability_tests {
    const DEFAULT_CAPABILITY: &str = include_str!("../capabilities/default.json");

    #[test]
    fn frontend_window_operations_have_explicit_permissions() {
        assert!(DEFAULT_CAPABILITY.contains("core:window:allow-show"));
        assert!(DEFAULT_CAPABILITY.contains("core:window:allow-set-title"));
        assert!(DEFAULT_CAPABILITY.contains("dialog:allow-open"));
    }
}

#[cfg(all(test, not(target_os = "macos")))]
mod title_tests {
    use super::{default_window_title, LoadedDocument};

    #[test]
    fn default_titles_include_the_product_name() {
        let document = LoadedDocument {
            path: Some("notes.md".to_string()),
            navigation_root: None,
            file_name: Some("notes.md".to_string()),
            html: Some("<h1>Notes</h1>".to_string()),
            error: None,
        };

        assert_eq!(default_window_title(&document), "notes.md - Hushmark");
    }
}
