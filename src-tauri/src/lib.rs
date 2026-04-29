mod document;

use std::path::PathBuf;

use document::{
    load_dropped_markdown_file, load_initial_document_from_arg, title_for, LoadedDocument,
};

#[tauri::command]
fn load_initial_document(window: tauri::Window) -> LoadedDocument {
    let document = load_initial_document_from_arg(std::env::args_os().nth(1));
    set_window_title(&window, &document);

    document
}

#[tauri::command]
fn load_dropped_document(path: String, window: tauri::Window) -> LoadedDocument {
    let document = load_dropped_markdown_file(PathBuf::from(path));
    set_window_title(&window, &document);

    document
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
            load_initial_document,
            load_dropped_document
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
