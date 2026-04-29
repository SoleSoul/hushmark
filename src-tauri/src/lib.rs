mod document;
mod identity;
mod setup;

use std::path::PathBuf;

use document::{
    load_dropped_markdown_file, load_initial_document_from_arg, title_for, LoadedDocument,
};
use identity::setup_window_title;
use serde::Serialize;
use setup::{
    first_document_arg, install_or_update as install_or_update_app,
    open_default_apps_settings as open_windows_default_apps_settings,
    remove_integration as remove_app_integration, setup_status, SetupStatus,
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
fn install_or_update() -> Result<SetupStatus, String> {
    install_or_update_app()
}

#[tauri::command]
fn remove_integration() -> Result<SetupStatus, String> {
    remove_app_integration()
}

#[tauri::command]
fn open_default_apps_settings() -> Result<(), String> {
    open_windows_default_apps_settings()
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
            install_or_update,
            remove_integration,
            open_default_apps_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
