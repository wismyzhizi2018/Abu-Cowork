//! Codex Pet atlas splitter — splits 1536×1872 spritesheet into per-row PNG strips
//!
//! PRD §7.4: Atlas → PNG strip splitting
//! - 9 rows × 8 frames per row, each frame 192×208
//! - Outputs horizontal PNG strip per row (8 frames stitched)
//! - Phase A: PNG strip only; future phases may add APNG encoding
//! - Writes output to themes directory

use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::Path;

/// Atlas layout constants (PRD §7.2)
const ATLAS_WIDTH: u32 = 1536;
const ATLAS_HEIGHT: u32 = 1872;
const FRAME_WIDTH: u32 = 192;
const FRAME_HEIGHT: u32 = 208;
const FRAMES_PER_ROW: u32 = 8;
const ROW_COUNT: u32 = 9;

/// Default frame durations per row (ms)
const DEFAULT_ROW_DURATIONS: [[u32; 8]; 9] = [
    [150, 150, 150, 150, 150, 150, 150, 150], // idle
    [100, 100, 100, 100, 100, 100, 100, 100], // running-right
    [100, 100, 100, 100, 100, 100, 100, 100], // running-left
    [200, 200, 200, 200, 200, 200, 200, 200], // waving
    [150, 150, 150, 150, 150, 150, 150, 150], // jumping
    [120, 120, 120, 120, 120, 120, 120, 120], // failed
    [200, 200, 200, 200, 200, 200, 200, 200], // waiting
    [100, 100, 100, 100, 100, 100, 100, 100], // running
    [180, 180, 180, 180, 180, 180, 180, 180], // review
];

/// State mapping from atlas row index
fn row_to_state(row: u32) -> &'static str {
    match row {
        0 => "idle",
        1 | 2 | 7 => "working",
        3 => "attention",
        4 => "attention", // alternative
        5 => "error",
        6 => "thinking",
        8 => "notification",
        _ => "idle",
    }
}

#[derive(Serialize, Deserialize)]
pub struct SplitFile {
    pub state: String,
    pub path: String,
}

#[derive(Serialize, Deserialize)]
pub struct SplitResult {
    pub files: Vec<SplitFile>,
}

/// Split a Codex Pet spritesheet into per-row APNG files.
///
/// `spritesheet_path`: absolute path to the spritesheet PNG
/// `pet_id`: pet identifier for naming output files
/// `output_dir`: directory to write APNG files into
#[tauri::command]
pub fn codex_pet_split_atlas(
    spritesheet_path: String,
    pet_id: String,
    output_dir: String,
) -> Result<SplitResult, String> {
    let img = image::open(&spritesheet_path)
        .map_err(|e| format!("Failed to open spritesheet: {}", e))?;

    let (w, h) = (img.width(), img.height());
    if w != ATLAS_WIDTH || h != ATLAS_HEIGHT {
        return Err(format!(
            "Invalid spritesheet dimensions: {}×{}, expected {}×{}",
            w, h, ATLAS_WIDTH, ATLAS_HEIGHT
        ));
    }

    let out_dir = Path::new(&output_dir);
    std::fs::create_dir_all(out_dir)
        .map_err(|e| format!("Failed to create output dir: {}", e))?;

    let mut files = Vec::new();

    for row in 0..ROW_COUNT {
        let state = row_to_state(row);
        let file_name = format!("{}-row{}.png", pet_id, row);
        let out_path = out_dir.join(&file_name);

        // Extract frames for this row and stitch into horizontal strip
        let strip_width = FRAME_WIDTH * FRAMES_PER_ROW;
        let mut strip = image::RgbaImage::new(strip_width, FRAME_HEIGHT);
        for col in 0..FRAMES_PER_ROW {
            let x = col * FRAME_WIDTH;
            let y = row * FRAME_HEIGHT;
            let frame = img.crop_imm(x, y, FRAME_WIDTH, FRAME_HEIGHT).to_rgba8();
            let x_offset = col * FRAME_WIDTH;
            for fy in 0..FRAME_HEIGHT {
                for fx in 0..FRAME_WIDTH {
                    let pixel = frame.get_pixel(fx, fy);
                    strip.put_pixel(x_offset + fx, fy, *pixel);
                }
            }
        }

        strip
            .save(&out_path)
            .map_err(|e| format!("Failed to save row {}: {}", row, e))?;

        files.push(SplitFile {
            state: state.to_string(),
            path: out_path.to_string_lossy().to_string(),
        });
    }

    Ok(SplitResult { files })
}

/// Install a generated theme.json to the themes directory.
#[tauri::command]
pub fn codex_pet_install_theme(
    pet_id: String,
    theme_json: String,
    themes_dir: String,
) -> Result<(), String> {
    let theme_dir = Path::new(&themes_dir).join(format!("codex-pet-{}", pet_id));
    std::fs::create_dir_all(&theme_dir)
        .map_err(|e| format!("Failed to create theme dir: {}", e))?;

    let theme_path = theme_dir.join("theme.json");
    std::fs::write(&theme_path, &theme_json)
        .map_err(|e| format!("Failed to write theme.json: {}", e))?;

    // Write import marker
    let marker = serde_json::json!({
        "managedBy": "codex-pet-importer",
        "schemaVersion": 1,
        "importedAt": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    });
    let marker_path = theme_dir.join(".abu-import-marker.json");
    std::fs::write(
        &marker_path,
        serde_json::to_string_pretty(&marker).unwrap_or_default(),
    )
    .map_err(|e| format!("Failed to write import marker: {}", e))?;

    Ok(())
}

/// Read a file's content as a UTF-8 string.
#[tauri::command]
pub fn read_file_content(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

/// Clean up a temporary directory created by codex_pet_extract_zip.
#[tauri::command]
pub fn codex_pet_cleanup_temp(temp_dir: String) -> Result<(), String> {
    let path = std::path::Path::new(&temp_dir);
    if path.exists() && path.starts_with(std::env::temp_dir()) {
        std::fs::remove_dir_all(path)
            .map_err(|e| format!("Failed to cleanup temp dir: {}", e))?;
    }
    Ok(())
}

/// Validate that a spritesheet has the correct dimensions (1536×1872).
#[tauri::command]
pub fn codex_pet_validate_spritesheet(path: String) -> Result<(), String> {
    let img = image::open(&path)
        .map_err(|e| format!("Failed to open image: {}", e))?;
    let (w, h) = (img.width(), img.height());
    if w != ATLAS_WIDTH || h != ATLAS_HEIGHT {
        return Err(format!(
            "Invalid spritesheet dimensions: {}×{}, expected {}×{}",
            w, h, ATLAS_WIDTH, ATLAS_HEIGHT
        ));
    }
    Ok(())
}

/// Get the app themes directory (~/.abu/themes/).
#[tauri::command]
pub fn get_app_themes_dir() -> Result<String, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Cannot determine home directory".to_string())?;
    let themes_dir = std::path::PathBuf::from(home).join(".abu").join("themes");
    Ok(themes_dir.to_string_lossy().to_string())
}

/// Result of extracting a Codex Pet zip.
#[derive(Serialize, Deserialize)]
pub struct ZipExtractResult {
    pub temp_dir: String,
    pub pet_json_path: String,
    pub spritesheet_path: String,
}

/// Extract a Codex Pet zip to a temp directory.
/// Validates: zip size ≤ 25MB, no encrypted entries, no path traversal,
/// must contain pet.json and a PNG/WebP spritesheet.
#[tauri::command]
pub fn codex_pet_extract_zip(zip_path: String) -> Result<ZipExtractResult, String> {
    let file = std::fs::File::open(&zip_path)
        .map_err(|e| format!("Failed to open zip: {}", e))?;

    let metadata = file.metadata().map_err(|e| format!("Failed to read metadata: {}", e))?;
    if metadata.len() > 25 * 1024 * 1024 {
        return Err("Zip file exceeds 25MB limit".to_string());
    }

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;

    // Create temp directory
    let temp_dir = tempfile::tempdir()
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;
    let temp_path = temp_dir.path().to_string_lossy().to_string();

    let mut pet_json_found = false;
    let mut spritesheet_found = false;
    let mut pet_json_path = String::new();
    let mut spritesheet_path = String::new();

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)
            .map_err(|e| format!("Failed to read zip entry {}: {}", i, e))?;

        let name = entry.name().to_string();

        // Security: reject encrypted entries
        if entry.encrypted() {
            return Err(format!("Encrypted zip entry not allowed: {}", name));
        }

        // Security: reject path traversal
        if name.contains("..") || name.starts_with('/') {
            return Err(format!("Path traversal detected: {}", name));
        }

        // Only extract pet.json and image files
        let lower = name.to_lowercase();
        if lower == "pet.json" || lower.ends_with(".png") || lower.ends_with(".webp") {
            let out_path = Path::new(&temp_path).join(&name);

            // Size checks
            let size = entry.size();
            if lower == "pet.json" && size > 64 * 1024 {
                return Err("pet.json exceeds 64KB".to_string());
            }
            if (lower.ends_with(".png") || lower.ends_with(".webp")) && size > 16 * 1024 * 1024 {
                return Err("Spritesheet exceeds 16MB".to_string());
            }

            // Write file
            let mut contents = Vec::new();
            entry.read_to_end(&mut contents)
                .map_err(|e| format!("Failed to read entry {}: {}", name, e))?;

            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create dir: {}", e))?;
            }
            std::fs::write(&out_path, &contents)
                .map_err(|e| format!("Failed to write {}: {}", name, e))?;

            if lower == "pet.json" {
                pet_json_found = true;
                pet_json_path = out_path.to_string_lossy().to_string();
            } else if lower.ends_with(".png") || lower.ends_with(".webp") {
                // Use the first image found as spritesheet
                if !spritesheet_found {
                    spritesheet_found = true;
                    spritesheet_path = out_path.to_string_lossy().to_string();
                }
            }
        }
    }

    if !pet_json_found {
        return Err("zip does not contain pet.json".to_string());
    }
    if !spritesheet_found {
        return Err("zip does not contain a PNG/WebP spritesheet".to_string());
    }

    // Prevent temp_dir from being dropped (caller is responsible for cleanup)
    // We leak the TempDir intentionally — the OS will clean up on reboot
    // or the caller can delete the directory manually
    let _ = temp_dir.into_path();

    Ok(ZipExtractResult {
        temp_dir: temp_path,
        pet_json_path,
        spritesheet_path,
    })
}
