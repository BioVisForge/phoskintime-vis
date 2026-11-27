//! tiny-skia spike (decision 0006): many polylines as one anti-aliased stroked path, FastLines
//! semantics. Measured slower than Canvas2D in Chromium and Firefox; kept only to reproduce that.
use tiny_skia::{LineCap, LineJoin, Paint, PathBuilder, Pixmap, Stroke, Transform};

#[no_mangle]
pub extern "C" fn alloc(bytes: usize) -> *mut u8 {
    let mut v = Vec::<u8>::with_capacity(bytes);
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}

#[no_mangle]
pub unsafe extern "C" fn dealloc(p: *mut u8, bytes: usize) {
    drop(Vec::from_raw_parts(p, 0, bytes));
}

/// xy: interleaved device-pixel coordinates (NaN y = gap); starts: first point of each series.
/// Writes straight (non-premultiplied) RGBA into `out` (w*h*4 bytes).
#[no_mangle]
pub unsafe extern "C" fn stroke_lines(xy: *const f64, n: usize, starts: *const i32, ns: usize, w: u32, h: u32, rgba: u32, alpha: f32, width: f32, out: *mut u8) -> i32 {
    let xy = std::slice::from_raw_parts(xy, n * 2);
    let starts = std::slice::from_raw_parts(starts, ns);
    let mut pb = PathBuilder::new();
    for s in 0..ns {
        let a = starts[s] as usize;
        let b = if s + 1 < ns { starts[s + 1] as usize } else { n };
        let mut pen = false;
        for i in a..b {
            let (x, y) = (xy[2 * i], xy[2 * i + 1]);
            if !x.is_finite() || !y.is_finite() {
                pen = false;
                continue;
            }
            if pen { pb.line_to(x as f32, y as f32) } else { pb.move_to(x as f32, y as f32) }
            pen = true;
        }
    }
    let Some(path) = pb.finish() else { return 0 };
    let Some(mut pm) = Pixmap::new(w, h) else { return -1 };
    let mut paint = Paint::default();
    paint.set_color_rgba8((rgba >> 24) as u8, (rgba >> 16) as u8, (rgba >> 8) as u8, ((rgba & 0xff) as f32 * alpha).round() as u8);
    paint.anti_alias = true;
    let stroke = Stroke { width, miter_limit: 10.0, line_cap: LineCap::Butt, line_join: LineJoin::Miter, dash: None };
    pm.stroke_path(&path, &paint, &stroke, Transform::identity(), None);
    let dst = std::slice::from_raw_parts_mut(out, (w * h * 4) as usize);
    for (k, p) in pm.pixels().iter().enumerate() {
        let c = p.demultiply();
        dst[4 * k] = c.red();
        dst[4 * k + 1] = c.green();
        dst[4 * k + 2] = c.blue();
        dst[4 * k + 3] = c.alpha();
    }
    1
}
