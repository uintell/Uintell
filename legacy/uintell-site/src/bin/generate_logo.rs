use std::fs::File;
use std::io::Write;
use united_intelligence::logo;

fn main() -> std::io::Result<()> {
    let mut file = File::create("static/logo.svg")?;
    file.write_all(logo::render_logo_svg().as_bytes())?;

    println!("Generated static/logo.svg");
    Ok(())
}
