use std::f64::consts::PI;

#[derive(Clone, Copy, Debug)]
struct Point {
    x: f64,
    y: f64,
}

pub fn render_logo_svg() -> String {
    let stroke_width = 2.0;
    let width = 1250.0;
    let height = 1250.0;
    let cx = width / 2.0;
    let cy = height / 2.0;
    let radius = 545.0;

    let n = 12;
    let points = polygon_points(n, cx, cy, radius, -PI / 2.0);

    let mut svg = String::new();

    svg.push_str(&format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">"#,
        w = width as i32,
        h = height as i32
    ));
    svg.push_str(r#"<rect width="100%" height="100%" fill="black"/>"#);

    svg.push_str(&format!(
        r##"<circle cx="{:.3}" cy="{:.3}" r="{:.3}" fill="none" stroke="#00ff33" stroke-width="{:.3}"/>"##,
        cx, cy, radius, stroke_width
    ));

    for i in 0..n {
        for j in (i + 1)..n {
            let a = points[i];
            let b = points[j];
            svg.push_str(&line(a, b, "#00ff33", stroke_width, 0.95));
        }
    }

    let accent_indices = [0, 1, 2, 3, 5, 7, 9, 10];
    for &i in &accent_indices {
        svg.push_str(&line(
            Point { x: cx, y: cy },
            points[i],
            "#00ff33",
            stroke_width,
            0.9,
        ));
    }

    for p in &points {
        svg.push_str(&format!(
            r##"<circle cx="{:.3}" cy="{:.3}" r="6.5" fill="#00ff33"/>"##,
            p.x, p.y
        ));
    }

    svg.push_str(&format!(
        r##"<circle cx="{:.3}" cy="{:.3}" r="5.0" fill="#00ff33"/>"##,
        cx, cy
    ));

    svg.push_str("</svg>");
    svg
}

fn polygon_points(n: usize, cx: f64, cy: f64, radius: f64, start_angle: f64) -> Vec<Point> {
    let mut pts = Vec::with_capacity(n);
    for i in 0..n {
        let angle = start_angle + 2.0 * PI * (i as f64) / (n as f64);
        pts.push(Point {
            x: cx + radius * angle.cos(),
            y: cy + radius * angle.sin(),
        });
    }
    pts
}

fn line(a: Point, b: Point, color: &str, width: f64, opacity: f64) -> String {
    format!(
        r#"<line x1="{:.3}" y1="{:.3}" x2="{:.3}" y2="{:.3}" stroke="{}" stroke-width="{:.3}" stroke-opacity="{:.3}"/>"#,
        a.x, a.y, b.x, b.y, color, width, opacity
    )
}
