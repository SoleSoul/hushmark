#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    configure_linux_webkit_environment();
    hushmark_lib::run()
}

#[cfg(target_os = "linux")]
fn configure_linux_webkit_environment() {
    // WebKitGTK's DMABUF renderer can produce blank windows on NVIDIA/X11 and
    // Wayland protocol errors on wlroots compositors. This must be set before
    // GTK/WebKit are initialized, but an explicit user value should still win.
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}

#[cfg(not(target_os = "linux"))]
fn configure_linux_webkit_environment() {}
