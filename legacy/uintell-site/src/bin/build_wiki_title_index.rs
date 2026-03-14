use std::{env, error::Error};

use united_intelligence::wiki;

fn main() -> Result<(), Box<dyn Error>> {
    let limit = env::var("UINTELL_WIKI_INDEX_LIMIT")
        .ok()
        .and_then(|value| value.parse::<usize>().ok());

    let stats = wiki::build_title_index(limit)?;
    println!(
        "wrote {} titles to {}",
        stats.titles_written,
        stats.path.display()
    );

    Ok(())
}
