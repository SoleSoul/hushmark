use std::{
    path::PathBuf,
    sync::{Mutex, MutexGuard},
};

use serde::Deserialize;
use tauri::{
    menu::{
        AboutMetadata, CheckMenuItem, CheckMenuItemBuilder, MenuBuilder, MenuItem, MenuItemBuilder,
        PredefinedMenuItem, SubmenuBuilder, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
    },
    App, AppHandle, Emitter, Manager, RunEvent, WebviewWindow, WindowEvent, Wry,
};
use tauri_plugin_dialog::DialogExt;

use crate::{document::LoadedDocument, identity::DISPLAY_NAME};

const MENU_EVENT: &str = "hushmark://macos-menu";
const OPEN_DOCUMENT_EVENT: &str = "hushmark://macos-open-document";

const MENU_OPEN: &str = "macos-open";
const MENU_PRINT: &str = "macos-print";
const MENU_BACK: &str = "macos-back";
const MENU_FORWARD: &str = "macos-forward";
const MENU_HOME: &str = "macos-home";
const MENU_HELP: &str = "macos-help";
const MENU_PAGE: &str = "macos-page";
const MENU_FULL_WIDTH: &str = "macos-full-width";
const MENU_ZOOM_IN: &str = "macos-zoom-in";
const MENU_ZOOM_OUT: &str = "macos-zoom-out";
const MENU_ACTUAL_SIZE: &str = "macos-actual-size";
const MENU_BRING_ALL_TO_FRONT: &str = "macos-bring-all-to-front";
const LAYOUT_ACCELERATOR: &str = "CmdOrCtrl+L";

struct OpenDocumentState {
    frontend_ready: bool,
    picker_open: bool,
    pending_paths: Vec<PathBuf>,
}

static OPEN_DOCUMENTS: Mutex<OpenDocumentState> = Mutex::new(OpenDocumentState {
    frontend_ready: false,
    picker_open: false,
    pending_paths: Vec::new(),
});

pub(crate) struct MacosMenuItems {
    print: MenuItem<Wry>,
    back: MenuItem<Wry>,
    forward: MenuItem<Wry>,
    page: CheckMenuItem<Wry>,
    full_width: CheckMenuItem<Wry>,
    zoom_in: MenuItem<Wry>,
    zoom_out: MenuItem<Wry>,
    actual_size: MenuItem<Wry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MacosMenuState {
    can_go_back: bool,
    can_go_forward: bool,
    can_print_document: bool,
    has_document: bool,
    layout: DocumentLayout,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
enum DocumentLayout {
    Page,
    FullWidth,
}

pub fn configure(builder: tauri::Builder<Wry>) -> tauri::Builder<Wry> {
    builder
        .setup(setup_menu)
        .on_menu_event(|app, event| emit_menu_command(app, event.id().as_ref()))
}

fn setup_menu(app: &mut App<Wry>) -> Result<(), Box<dyn std::error::Error>> {
    let about = PredefinedMenuItem::about(
        app,
        Some("About Hushmark"),
        Some(AboutMetadata {
            name: Some(DISPLAY_NAME.to_string()),
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
            copyright: app.config().bundle.copyright.clone(),
            ..Default::default()
        }),
    )?;
    let app_menu = SubmenuBuilder::new(app, DISPLAY_NAME)
        .item(&about)
        .separator()
        .services()
        .separator()
        .hide_with_text("Hide Hushmark")
        .hide_others()
        .show_all()
        .separator()
        .quit_with_text("Quit Hushmark")
        .build()?;

    let open = menu_item(app, MENU_OPEN, "Open…", true, Some("CmdOrCtrl+O"))?;
    let print = menu_item(app, MENU_PRINT, "Print…", false, Some("CmdOrCtrl+P"))?;
    let close = PredefinedMenuItem::close_window(app, Some("Close"))?;
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&open)
        .separator()
        .item(&close)
        .separator()
        .item(&print)
        .build()?;

    let copy = PredefinedMenuItem::copy(app, None)?;
    let select_all = PredefinedMenuItem::select_all(app, None)?;
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&copy)
        .item(&select_all)
        .build()?;

    let back = menu_item(app, MENU_BACK, "Back", false, Some("CmdOrCtrl+BracketLeft"))?;
    let forward = menu_item(
        app,
        MENU_FORWARD,
        "Forward",
        false,
        Some("CmdOrCtrl+BracketRight"),
    )?;
    let home = menu_item(
        app,
        MENU_HOME,
        "Home / Help",
        true,
        Some("CmdOrCtrl+Shift+H"),
    )?;
    let go_menu = SubmenuBuilder::new(app, "Go")
        .item(&back)
        .item(&forward)
        .separator()
        .item(&home)
        .build()?;

    let page = CheckMenuItemBuilder::with_id(MENU_PAGE, "Page")
        .enabled(false)
        .checked(true)
        .build(app)?;
    let full_width = CheckMenuItemBuilder::with_id(MENU_FULL_WIDTH, "Full Width")
        .enabled(false)
        .checked(false)
        .accelerator(LAYOUT_ACCELERATOR)
        .build(app)?;
    let zoom_in = menu_item(app, MENU_ZOOM_IN, "Zoom In", false, Some("CmdOrCtrl+Equal"))?;
    let zoom_out = menu_item(
        app,
        MENU_ZOOM_OUT,
        "Zoom Out",
        false,
        Some("CmdOrCtrl+Minus"),
    )?;
    let actual_size = menu_item(
        app,
        MENU_ACTUAL_SIZE,
        "Actual Size",
        false,
        Some("CmdOrCtrl+0"),
    )?;
    let full_screen = PredefinedMenuItem::fullscreen(app, Some("Enter Full Screen"))?;
    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&page)
        .item(&full_width)
        .separator()
        .item(&zoom_in)
        .item(&zoom_out)
        .item(&actual_size)
        .separator()
        .item(&full_screen)
        .build()?;

    let minimize = PredefinedMenuItem::minimize(app, None)?;
    let zoom_window = PredefinedMenuItem::maximize(app, Some("Zoom"))?;
    let bring_all_to_front = menu_item(
        app,
        MENU_BRING_ALL_TO_FRONT,
        "Bring All to Front",
        true,
        None,
    )?;
    let window_menu = SubmenuBuilder::with_id(app, WINDOW_SUBMENU_ID, "Window")
        .item(&minimize)
        .item(&zoom_window)
        .separator()
        .item(&bring_all_to_front)
        .build()?;

    let help = menu_item(
        app,
        MENU_HELP,
        "Home / Help",
        true,
        Some("CmdOrCtrl+Shift+Slash"),
    )?;
    let help_menu = SubmenuBuilder::with_id(app, HELP_SUBMENU_ID, "Help")
        .item(&help)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &app_menu,
            &file_menu,
            &edit_menu,
            &go_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ])
        .build()?;
    app.set_menu(menu)?;
    app.manage(MacosMenuItems {
        print,
        back,
        forward,
        page,
        full_width,
        zoom_in,
        zoom_out,
        actual_size,
    });

    Ok(())
}

fn menu_item(
    app: &App<Wry>,
    id: &str,
    text: &str,
    enabled: bool,
    accelerator: Option<&str>,
) -> tauri::Result<MenuItem<Wry>> {
    let mut builder = MenuItemBuilder::with_id(id, text).enabled(enabled);
    if let Some(accelerator) = accelerator {
        builder = builder.accelerator(accelerator);
    }
    builder.build(app)
}

fn emit_menu_command(app: &AppHandle, command: &str) {
    if command == MENU_BRING_ALL_TO_FRONT {
        show_main_window(app);
        return;
    }

    if command == MENU_PRINT {
        if let Err(error) = print_main_window(app) {
            eprintln!("failed to print the macOS document: {error}");
        }
        return;
    }

    if command == MENU_OPEN {
        open_document_picker(app);
        return;
    }

    if is_frontend_menu_command(command) {
        let Some(window) = main_window(app) else {
            return;
        };

        if let Err(error) = window.emit(MENU_EVENT, command.to_string()) {
            eprintln!("failed to emit macOS menu command: {error}");
        }
    }
}

fn is_frontend_menu_command(command: &str) -> bool {
    matches!(
        command,
        MENU_BACK
            | MENU_FORWARD
            | MENU_HOME
            | MENU_HELP
            | MENU_PAGE
            | MENU_FULL_WIDTH
            | MENU_ZOOM_IN
            | MENU_ZOOM_OUT
            | MENU_ACTUAL_SIZE
    )
}

fn open_document_picker(app: &AppHandle) {
    let Some(window) = main_window(app) else {
        return;
    };

    {
        let mut state = open_document_state();
        if state.picker_open {
            return;
        }
        state.picker_open = true;
    }

    show_main_window(app);
    let app = app.clone();
    app.dialog()
        .file()
        .set_parent(&window)
        .add_filter("Markdown files", &["md", "markdown"])
        .pick_file(move |selection| {
            open_document_state().picker_open = false;

            let Some(selection) = selection else {
                return;
            };

            match selection.into_path() {
                Ok(path) => open_documents(&app, vec![path]),
                Err(error) => eprintln!("failed to resolve the selected macOS document: {error}"),
            }
        });
}

#[tauri::command]
pub(crate) fn print_macos_document(app: AppHandle) -> Result<(), String> {
    print_main_window(&app)
}

#[tauri::command]
pub(crate) fn macos_frontend_ready() -> Vec<String> {
    let mut state = open_document_state();
    state.frontend_ready = true;
    state
        .pending_paths
        .drain(..)
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

#[tauri::command]
pub(crate) fn update_macos_menu_state(
    menu: tauri::State<'_, MacosMenuItems>,
    state: MacosMenuState,
) -> Result<(), String> {
    set_enabled(&menu.print, state.can_print_document)?;
    set_enabled(&menu.back, state.can_go_back)?;
    set_enabled(&menu.forward, state.can_go_forward)?;
    set_enabled(&menu.zoom_in, state.has_document)?;
    set_enabled(&menu.zoom_out, state.has_document)?;
    set_enabled(&menu.actual_size, state.has_document)?;
    menu.page
        .set_enabled(state.has_document)
        .map_err(menu_error)?;
    menu.full_width
        .set_enabled(state.has_document)
        .map_err(menu_error)?;
    menu.page
        .set_checked(state.layout == DocumentLayout::Page)
        .map_err(menu_error)?;
    menu.full_width
        .set_checked(state.layout == DocumentLayout::FullWidth)
        .map_err(menu_error)?;
    update_layout_accelerator(&menu, state.layout)?;
    Ok(())
}

fn update_layout_accelerator(
    menu: &MacosMenuItems,
    current_layout: DocumentLayout,
) -> Result<(), String> {
    if current_layout == DocumentLayout::FullWidth {
        menu.full_width
            .set_accelerator(None::<&str>)
            .map_err(menu_error)?;
        menu.page
            .set_accelerator(Some(LAYOUT_ACCELERATOR))
            .map_err(menu_error)
    } else {
        menu.page
            .set_accelerator(None::<&str>)
            .map_err(menu_error)?;
        menu.full_width
            .set_accelerator(Some(LAYOUT_ACCELERATOR))
            .map_err(menu_error)
    }
}

fn set_enabled(item: &MenuItem<Wry>, enabled: bool) -> Result<(), String> {
    item.set_enabled(enabled).map_err(menu_error)
}

fn menu_error(error: tauri::Error) -> String {
    format!("Could not update the macOS menu: {error}")
}

pub fn handle_run_event(app: &AppHandle, event: RunEvent) {
    match event {
        RunEvent::Opened { urls } => {
            let paths = urls
                .into_iter()
                .filter_map(|url| url.to_file_path().ok())
                .collect::<Vec<_>>();
            open_documents(app, paths);
        }
        RunEvent::Reopen {
            has_visible_windows,
            ..
        } if !has_visible_windows => show_main_window(app),
        RunEvent::WindowEvent {
            label,
            event: WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "main" => {
            api.prevent_close();
            if let Some(window) = main_window(app) {
                if let Err(error) = window.hide() {
                    eprintln!("failed to hide the macOS window: {error}");
                }
            }
        }
        _ => {}
    }
}

fn open_documents(app: &AppHandle, paths: Vec<PathBuf>) {
    if paths.is_empty() {
        return;
    }

    show_main_window(app);

    let frontend_ready = {
        let mut state = open_document_state();
        if state.frontend_ready {
            true
        } else {
            state.pending_paths.extend(paths.iter().cloned());
            false
        }
    };

    if frontend_ready {
        if let Some(window) = main_window(app) {
            for path in paths {
                if let Err(error) =
                    window.emit(OPEN_DOCUMENT_EVENT, path.to_string_lossy().into_owned())
                {
                    eprintln!("failed to emit macOS open-document event: {error}");
                }
            }
        }
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        if let Err(error) = window.show() {
            eprintln!("failed to show the macOS window: {error}");
        }
        if let Err(error) = window.set_focus() {
            eprintln!("failed to focus the macOS window: {error}");
        }
    }
}

fn print_main_window(app: &AppHandle) -> Result<(), String> {
    main_window(app)
        .ok_or_else(|| "The Hushmark window is not available.".to_string())?
        .print()
        .map_err(|error| format!("Could not open the macOS print dialog: {error}"))
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

fn open_document_state() -> MutexGuard<'static, OpenDocumentState> {
    OPEN_DOCUMENTS
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub fn title_for(document: &LoadedDocument) -> String {
    match (&document.file_name, &document.error) {
        (Some(file_name), Some(_)) => format!("Error: {file_name}"),
        (Some(file_name), None) => file_name.clone(),
        (None, Some(_)) => "Error".to_string(),
        (None, None) => DISPLAY_NAME.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::{is_frontend_menu_command, title_for, MENU_HOME, MENU_OPEN, MENU_PRINT};
    use crate::document::LoadedDocument;

    fn document(file_name: Option<&str>, error: Option<&str>) -> LoadedDocument {
        LoadedDocument {
            path: None,
            navigation_root: None,
            file_name: file_name.map(str::to_owned),
            html: None,
            error: error.map(str::to_owned),
        }
    }

    #[test]
    fn macos_titles_describe_the_document_without_repeating_the_product_name() {
        assert_eq!(title_for(&document(Some("notes.md"), None)), "notes.md");
        assert_eq!(
            title_for(&document(Some("notes.md"), Some("unreadable"))),
            "Error: notes.md"
        );
        assert_eq!(title_for(&document(None, Some("unreadable"))), "Error");
        assert_eq!(title_for(&document(None, None)), "Hushmark");
    }

    #[test]
    fn only_semantic_reader_commands_cross_the_frontend_menu_boundary() {
        assert!(is_frontend_menu_command(MENU_HOME));
        assert!(!is_frontend_menu_command(MENU_OPEN));
        assert!(!is_frontend_menu_command(MENU_PRINT));
        assert!(!is_frontend_menu_command("CloseWindow"));
    }
}
