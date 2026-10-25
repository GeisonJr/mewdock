use serde::{Deserialize, Serialize};
use tauri::{PhysicalPosition, PhysicalSize};

/// Gap between the window and the screen edge, in logical px.
const EDGE_MARGIN: f64 = 12.0;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Left,
    #[default]
    Right,
}

/// The cat's bounds in logical px, relative to the window's top-left corner.
#[derive(Clone, Copy, Debug, Default, PartialEq, Deserialize)]
pub struct HitRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Bottom corner of the monitor, in the strip beside a bottom Dock.
pub fn window_origin(
    monitor_position: PhysicalPosition<i32>,
    monitor_size: PhysicalSize<u32>,
    scale: f64,
    (width, height): (f64, f64),
    side: Side,
) -> PhysicalPosition<i32> {
    let margin = (EDGE_MARGIN * scale).round() as i32;
    let width = (width * scale).round() as i32;
    let height = (height * scale).round() as i32;
    let monitor_width = monitor_size.width as i32;
    let monitor_height = monitor_size.height as i32;
    let x = match side {
        Side::Left => monitor_position.x + margin,
        Side::Right => monitor_position.x + monitor_width - width - margin,
    };
    PhysicalPosition::new(x, monitor_position.y + monitor_height - height)
}

pub fn cursor_hits(
    cursor: PhysicalPosition<f64>,
    window_origin: PhysicalPosition<f64>,
    scale: f64,
    rect: HitRect,
) -> bool {
    let x = (cursor.x - window_origin.x) / scale;
    let y = (cursor.y - window_origin.y) / scale;
    x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

#[cfg(test)]
mod tests {
    use super::*;

    const MONITOR: PhysicalSize<u32> = PhysicalSize { width: 3024, height: 1964 };

    #[test]
    fn places_window_in_bottom_corners() {
        let origin = PhysicalPosition::new(0, 0);
        let right = window_origin(origin, MONITOR, 2.0, (240.0, 64.0), Side::Right);
        let left = window_origin(origin, MONITOR, 2.0, (240.0, 64.0), Side::Left);
        assert_eq!(right, PhysicalPosition::new(3024 - 480 - 24, 1964 - 128));
        assert_eq!(left, PhysicalPosition::new(24, 1964 - 128));
    }

    #[test]
    fn places_window_on_offset_monitor() {
        let origin = PhysicalPosition::new(-1920, 100);
        let size = PhysicalSize::new(1920, 1080);
        let left = window_origin(origin, size, 1.0, (240.0, 64.0), Side::Left);
        assert_eq!(left, PhysicalPosition::new(-1908, 100 + 1080 - 64));
    }

    #[test]
    fn hits_only_inside_rect() {
        let rect = HitRect { x: 100.0, y: 10.0, width: 40.0, height: 50.0 };
        let window = PhysicalPosition::new(1000.0, 500.0);
        let inside = PhysicalPosition::new(1000.0 + 120.0 * 2.0, 500.0 + 30.0 * 2.0);
        let outside = PhysicalPosition::new(1000.0 + 20.0 * 2.0, 500.0 + 30.0 * 2.0);
        assert!(cursor_hits(inside, window, 2.0, rect));
        assert!(!cursor_hits(outside, window, 2.0, rect));
        assert!(!cursor_hits(inside, window, 2.0, HitRect::default()));
    }
}
