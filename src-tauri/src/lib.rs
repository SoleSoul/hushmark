mod document;
mod external_links;
mod identity;
mod setup;

use std::path::PathBuf;

use document::{
    load_dropped_markdown_file, load_initial_document_from_arg, title_for, LoadedDocument,
};
use identity::setup_window_title;
use serde::Serialize;
use setup::{
    first_document_arg, open_default_apps_settings as open_windows_default_apps_settings,
    remove_all_integration as remove_all_app_integration, setup_status,
    toggle_context_menu as toggle_app_context_menu, toggle_install as toggle_app_install,
    toggle_open_with_support as toggle_app_open_with_support, SetupStatus,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StartupView {
    mode: String,
    document: Option<LoadedDocument>,
    setup: Option<SetupStatus>,
}

#[tauri::command]
fn load_initial_view(window: tauri::Window) -> Result<StartupView, String> {
    let args: Vec<_> = std::env::args_os().skip(1).collect();

    if args.iter().any(|arg| setup::is_install_mode_arg(arg)) {
        window
            .set_title(&setup_window_title())
            .map_err(|error| format!("Could not set setup window title: {error}"))?;

        return Ok(StartupView {
            mode: "setup".to_string(),
            document: None,
            setup: Some(setup_status(None)?),
        });
    }

    let document = load_initial_document_from_arg(first_document_arg(args.into_iter()));
    set_window_title(&window, &document);

    Ok(StartupView {
        mode: "reader".to_string(),
        document: Some(document),
        setup: None,
    })
}

#[tauri::command]
fn load_dropped_document(path: String, window: tauri::Window) -> LoadedDocument {
    let document = load_dropped_markdown_file(PathBuf::from(path));
    set_window_title(&window, &document);

    document
}

#[tauri::command]
fn get_setup_status() -> Result<SetupStatus, String> {
    setup_status(None)
}

#[tauri::command]
fn toggle_install() -> Result<SetupStatus, String> {
    toggle_app_install()
}

#[tauri::command]
fn toggle_open_with_support() -> Result<SetupStatus, String> {
    toggle_app_open_with_support()
}

#[tauri::command]
fn toggle_context_menu() -> Result<SetupStatus, String> {
    toggle_app_context_menu()
}

#[tauri::command]
fn remove_all_integration() -> Result<SetupStatus, String> {
    remove_all_app_integration()
}

#[tauri::command]
fn open_default_apps_settings() -> Result<SetupStatus, String> {
    open_windows_default_apps_settings()
}

#[tauri::command]
fn open_external_link(url: String) -> Result<(), String> {
    external_links::open_external_link(&url)
}

fn set_window_title(window: &tauri::Window, document: &LoadedDocument) {
    if let Err(error) = window.set_title(&title_for(document)) {
        eprintln!("failed to set window title: {error}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_initial_view,
            load_dropped_document,
            get_setup_status,
            toggle_install,
            toggle_open_with_support,
            toggle_context_menu,
            remove_all_integration,
            open_default_apps_settings,
            open_external_link
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
