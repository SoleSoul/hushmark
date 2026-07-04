mod document;
mod external_links;
mod identity;
#[cfg(windows)]
mod setup;
mod startup;

use std::path::PathBuf;

use document::{
    load_dropped_markdown_file, load_initial_document_from_arg, load_linked_markdown_file,
    title_for, LinkedDocument, LoadedDocument,
};
#[cfg(windows)]
use identity::setup_window_title;
use serde::Serialize;
#[cfg(windows)]
use setup::{
    open_default_apps_settings as open_windows_default_apps_settings,
    remove_all_integration as remove_all_app_integration, setup_status,
    toggle_context_menu as toggle_app_context_menu, toggle_install as toggle_app_install,
    toggle_open_with_support as toggle_app_open_with_support, SetupStatus,
};
use startup::first_document_arg;
#[cfg(windows)]
use startup::is_setup_mode_arg;
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
    mode: String,
    document: Option<LoadedDocument>,
    #[cfg(windows)]
    setup: Option<SetupStatus>,
    capabilities: PlatformCapabilities,
}

#[tauri::command]
fn load_initial_view(window: tauri::Window) -> Result<StartupView, String> {
    let args: Vec<_> = std::env::args_os().skip(1).collect();

    #[cfg(windows)]
    if args.iter().any(|arg| is_setup_mode_arg(arg)) {
        window
            .set_title(&setup_window_title())
            .map_err(|error| format!("Could not set setup window title: {error}"))?;

        return Ok(StartupView {
            mode: "setup".to_string(),
            document: None,
            setup: Some(setup_status(None)?),
            capabilities: PlatformCapabilities::current(),
        });
    }

    let document = load_initial_document_from_arg(first_document_arg(args.into_iter()));
    set_window_title(&window, &document);

    Ok(StartupView {
        mode: "reader".to_string(),
        document: Some(document),
        #[cfg(windows)]
        setup: None,
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
fn toggle_install() -> Result<SetupStatus, String> {
    toggle_app_install()
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
fn remove_all_integration() -> Result<SetupStatus, String> {
    remove_all_app_integration()
}

#[cfg(windows)]
#[tauri::command]
fn open_default_apps_settings() -> Result<SetupStatus, String> {
    open_windows_default_apps_settings()
}

#[tauri::command]
fn open_external_link(url: String, app: tauri::AppHandle) -> Result<(), String> {
    let url = external_links::allowed_external_url(&url)?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| format!("Could not open external link: {error}"))
}

fn set_window_title(window: &tauri::Window, document: &LoadedDocument) {
    if let Err(error) = window.set_title(&title_for(document)) {
        eprintln!("failed to set window title: {error}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init());

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
        open_default_apps_settings,
        open_external_link
    ]);

    #[cfg(not(windows))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        load_initial_view,
        load_dropped_document,
        load_linked_document,
        open_external_link
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
