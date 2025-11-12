// Load .env
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");      // node-fetch v2
const FormData = require("form-data");

// ========== CONFIG DARI .env ==========
const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID      = process.env.TELEGRAM_CHAT_ID;      // id grup/channel/privat
const UPLOAD_ROOT  = process.env.UPLOAD_ROOT || "uploads";
const MAX_FILE_MB  = Number(process.env.MAX_FILE_MB || 1900); // batas maksimal per file (MB)

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("ERROR: TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum di-set di .env");
  process.exit(1);
}

const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ========== KONFIG FORMAT YANG DIDUKUNG ==========

// list ekstensi yang dianggap IMAGE (photo)
const IMAGE_EXT = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".bmp", ".tif", ".tiff", ".jfif"
];

// list ekstensi yang dianggap VIDEO
const VIDEO_EXT = [
  ".mp4", ".mov", ".mkv", ".webm", ".avi",
  ".flv", ".wmv", ".m4v"
];

// Deteksi tipe media untuk Telegram: "photo" | "video" | "document" | null
function getMediaType(fileName) {
  const ext = path.extname(fileName).toLowerCase();

  if (IMAGE_EXT.includes(ext)) return "photo";
  if (VIDEO_EXT.includes(ext)) return "video";

  // Kalau bukan foto/video, tapi tetap mau kirim, pakai "document"
  // Kalau mau di-skip, return null saja
  return "document";
}

// Helper basic
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFileSizeMB(fullPath) {
  const stats = fs.statSync(fullPath);
  return stats.size / (1024 * 1024);
}

// ========== UTIL: PROGRESS BAR & PEMBATAS ==========
function renderProgress(current, total) {
  const barLength = 20; // panjang bar
  const ratio = total === 0 ? 0 : current / total;
  const filled = Math.round(barLength * ratio);
  const empty = barLength - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const percent = Math.round(ratio * 100);

  process.stdout.write(
    `\r  Progress: [${bar}] ${current}/${total} (${percent}%)`
  );

  if (current >= total) {
    process.stdout.write("\n");
  }
}

function printFolderSeparator() {
  console.log("────────────────────────────────────────────────────────");
}

// ========== KIRIM MEDIA GROUP (MAX N FILE) ==========
async function sendMediaGroup(files, caption) {
  const formData = new FormData();
  formData.append("chat_id", CHAT_ID);

  const media = [];

  files.forEach((file, idx) => {
    const fieldName = `file${idx}`;
    formData.append(fieldName, fs.createReadStream(file.fullPath));

    media.push({
      type: file.type,                        // "photo" | "video" | "document"
      media: `attach://${fieldName}`,
      caption: idx === 0 ? caption : undefined, // caption hanya di media pertama
    });
  });

  formData.append("media", JSON.stringify(media));

  const res = await fetch(`${API_URL}/sendMediaGroup`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`sendMediaGroup failed: ${res.status} - ${text}`);
  }

  return res.json();
}

// ========== UPLOAD 1 FOLDER (NAMA FOLDER = CAPTION) ==========
async function uploadFolder(folderPath, caption) {
  printFolderSeparator();
  console.log(`📂 Folder: ${caption}`);

  const files = fs.readdirSync(folderPath);

  // Bangun list media: deteksi type per file
  const allItems = [];

  for (const name of files) {
    const fullPath = path.join(folderPath, name);

    // Skip kalau bukan file (misal folder di dalam folder)
    if (!fs.statSync(fullPath).isFile()) continue;

    const mediaType = getMediaType(name);
    if (!mediaType) {
      console.warn(`  [SKIP] ${name} (tipe tidak dikenal)`);
      continue;
    }

    const sizeMB = getFileSizeMB(fullPath);
    if (sizeMB > MAX_FILE_MB) {
      console.warn(
        `  [SKIP] ${name} (${sizeMB.toFixed(2)} MB) > limit ${MAX_FILE_MB} MB`
      );
      continue;
    }

    allItems.push({
      name,
      fullPath,
      type: mediaType, // "photo" | "video" | "document"
    });
  }

  if (allItems.length === 0) {
    console.log("  (Tidak ada file yang bisa diupload, semua di-skip)");
    return;
  }

  // Urutkan: photo dulu, lalu video, lalu document
  const mediaItems = [
    ...allItems.filter((m) => m.type === "photo"),
    ...allItems.filter((m) => m.type === "video"),
    ...allItems.filter((m) => m.type === "document"),
  ];

  console.log(`  🗂️ Total media yang akan diupload: ${mediaItems.length}`);
  console.log("  Mulai upload...");

  const batchSize = 5; // jumlah file per batch
  let batchNumber = 1;
  let uploadedCount = 0;

  for (let i = 0; i < mediaItems.length; i += batchSize) {
    const batch = mediaItems.slice(i, i + batchSize);

    const listLabel = batch
      .map((f) => {
        const icon =
          f.type === "photo" ? "📷" :
          f.type === "video" ? "🎥" :
          "📎";
        return `${icon} ${path.basename(f.fullPath)}`;
      })
      .join(", ");

    console.log(
      `  ─ Batch ${batchNumber} (${batch.length} file): ${listLabel}`
    );

    try {
      await sendMediaGroup(batch, caption);
      uploadedCount += batch.length;
    } catch (err) {
      console.error(`  ⚠️ Error sendMediaGroup batch ${batchNumber}:`, err.message);
    }

    renderProgress(uploadedCount, mediaItems.length);

    batchNumber++;
    await delay(2000); // jeda 2 detik antar batch
  }

  console.log(`  ✅ Selesai folder: ${caption}`);
  printFolderSeparator();
}

// ========== MAIN: LOOP SEMUA SUBFOLDER DI uploads/ ==========
async function main() {
  console.log("Mulai upload ke Telegram per folder...\n");

  const root = path.resolve(UPLOAD_ROOT);
  if (!fs.existsSync(root)) {
    console.error(`Folder uploads tidak ditemukan: ${root}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (folders.length === 0) {
    console.log("Tidak ada subfolder di dalam uploads.");
    return;
  }

  for (const folderName of folders) {
    const folderPath = path.join(root, folderName);
    const caption = folderName; // nama folder jadi caption

    try {
      await uploadFolder(folderPath, caption);
    } catch (err) {
      console.error(`  Error di folder "${folderName}":`, err.message);
    }
  }

  console.log("\nSelesai upload semua folder ke Telegram.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
});
