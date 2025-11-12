# Telegram Folder Uploader Bot

Bot sederhana berbasis **Node.js** untuk **auto-upload foto & video ke Telegram** dari struktur folder lokal.

- Folder utama: `uploads/`
- Setiap **sub-folder** di dalam `uploads` dianggap sebagai **satu grup upload**
- **Nama folder** akan menjadi **caption** di Telegram
- File di dalam folder:
  - Semua **foto** (png, jpg, jpeg, webp, gif, dll) dikirim sebagai `photo`
  - Semua **video** (mp4, mov, mkv, webm, dll) dikirim sebagai `video`
  - Format lain (pdf, zip, dll) bisa dikirim sebagai `document`
- Upload dilakukan **per batch** (misal 5 file per batch) dengan `sendMediaGroup`
- Ada tampilan **progress bar** di terminal + pemisah per folder biar rapi 🎯

---

## Fitur

- ✅ Auto-scan folder `uploads/` dan semua sub-folder di dalamnya
- ✅ Nama folder = caption di Telegram
- ✅ Foto dulu → video → (opsional) document
- ✅ Kirim media per batch (default 5 file / batch)
- ✅ Support banyak format gambar & video (png, jpg, jpeg, webp, gif, mp4, mov, mkv, webm, dll)
- ✅ Limit ukuran file per MB (diatur via `.env`)
- ✅ Tampilan terminal yang rapi:
  - Separator per folder
  - Info total media per folder
  - Progress bar: `Progress: [██████░░░░░░░░░░░░] 5/10 (50%)`
- ✅ Log file yang di-skip (misalnya: terlalu besar / format tidak didukung)

---

## .env

```text
TELEGRAM_BOT_TOKEN=ISI_TOKEN_DARI_BOTFATHER
TELEGRAM_CHAT_ID=ISI_CHAT_ID_GRUP_ATAU_CHANNEL
UPLOAD_ROOT=uploads
MAX_FILE_MB=500

