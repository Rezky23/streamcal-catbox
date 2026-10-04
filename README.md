# 🚀 Streamcal — Lightweight Catbox-Style Image & File Hosting

**Streamcal** adalah website hosting file dan image-to-URL berkecepatan tinggi yang dirancang persis dengan utilitas dan kemudahan **Catbox.moe**, diperkuat oleh **MongoDB Atlas** dan arsitektur Node.js yang sangat ringan (*zero-bloat*).

---

## ✨ Fitur Utama

- ⚡ **Image to Direct Short URL**: Upload gambar atau file apa saja, langsung dapatkan direct link pendek (contoh: `http://localhost:3000/a3f8b9.png`).
- 🎯 **Arsitektur Super Ringan (Anti-Lag / Low RAM)**:
  - **Server-side**: Menggunakan *disk-streaming* via `multer`. File berukuran besar (hingga 200MB) langsung dialirkan ke disk tanpa disimpan di memori RAM server, menjaga konsumsi RAM server di bawah ~40MB!
  - **Client-side / Browser**: Menggunakan Vanilla HTML5, CSS3, dan JavaScript murni tanpa framework berat (React/Vue/Webpack). Beban payload di bawah 50KB, halaman termuat dalam hitungan milidetik di HP kentang maupun PC lawas.
  - **Deduplikasi Otomatis (SHA-256)**: Jika file yang sama diupload berulang kali, server tidak akan menduplikasi file fisik di disk, menghemat storage dan bandwidth.
  - **HTTP 206 Streaming & Aggressive Caching**: File gambar/media dilengkapi header `Cache-Control: public, max-age=31536000, immutable` dan chunk range-seek untuk video/audio streaming.
- 🍃 **MongoDB Atlas Ready**: Menyimpan seluruh metadata file (original name, slug, MIME type, ukuran bytes, SHA-256 hash, jumlah views/unduhan, dan timestamp) secara terstruktur.
- 🛡️ **Graceful Fallback Mode**: Jika URI MongoDB Atlas belum dimasukkan di `.env`, aplikasi tetap dapat berjalan normal menggunakan penyimpanan lokal tanpa pernah *crash*.
- 🌐 **Upload via URL**: Mengunduh dan mengubah file dari URL remote langsung menjadi link Streamcal.
- 📋 **Drag & Drop & Clipboard Paste (Ctrl+V)**: Langsung paste screenshot layar ke browser untuk upload instan.
- 🌓 **Dark & Light Mode**: Desain modern bersih dengan toggle tema yang tersimpan di localStorage.

---

## 📂 Struktur File & Folder yang Terstruktur

```text
Tools/
├── .env                  # Konfigurasi environment (PORT, MongoDB URI, limit upload)
├── .env.example          # Template konfigurasi environment
├── package.json          # Dependency project
├── README.md             # Dokumentasi lengkap
├── uploads/              # Direktori penyimpanan file yang diunggah
└── src/
    ├── server.js         # Entry point Express server (kompresi, security, routing)
    ├── config/
    │   ├── db.js         # Manajemen koneksi MongoDB Atlas & graceful fallback
    │   └── env.js        # Validasi & parsing environment variables
    ├── models/
    │   └── File.js       # Mongoose Schema untuk metadata file di MongoDB Atlas
    ├── controllers/
    │   ├── uploadController.js # Logika upload file lokal & remote URL
    │   └── fileController.js   # Pengiriman file langsung (/slug.ext) & statistik
    ├── middlewares/
    │   ├── upload.js     # Konfigurasi multer disk-stream & penamaan short ID
    │   └── errorHandler.js # Handler error terpusat yang aman
    ├── services/
    │   └── fileService.js # Layer abstraksi MongoDB Atlas & memory store
    ├── utils/
    │   ├── idGenerator.js # Pembuat kode unik 6 karakter (alphanumeric)
    │   ├── hash.js        # Penghitung SHA-256 streaming hemat memori
    │   └── helpers.js     # Format bytes, ekstensi MIME, & validasi URL
    └── public/           # Frontend statis ultra-cepat
        ├── index.html    # Antarmuka web Catbox-style
        ├── css/
        │   └── style.css # Styling CSS murni, responsive, dark/light mode
        ├── js/
        │   └── app.js    # Logic client: Drag-drop, XHR progress bar, history
        └── assets/
            └── mascot.svg # Logo & maskot Streamcal
```

---

## 🛠️ Cara Menjalankan Project

### 1. Prasyarat
- Pastikan [Node.js](https://nodejs.org/) (versi 18+) sudah terinstall.

### 2. Konfigurasi Environment (`.env`)
Buka file `.env` di root folder. Sesuaikan pengaturannya:
```env
PORT=3000
BASE_URL=http://localhost:3000

# Masukkan URI MongoDB Atlas Anda:
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/streamcal?retryWrites=true&w=majority

MAX_FILE_SIZE_MB=200
UPLOAD_DIR=./uploads
NODE_ENV=development
```

> **Catatan MongoDB Atlas**:
> 1. Buat database gratis di [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
> 2. Klik **Connect** -> **Drivers (Node.js)**.
> 3. Salin connection string dan tempel pada `MONGODB_URI` di file `.env`.
> 4. Jika Anda belum mengisi `MONGODB_URI`, Streamcal akan tetap berjalan menggunakan *local fallback* sehingga website siap diuji coba langsung!

### 3. Jalankan Server
```bash
# Menjalankan mode production
npm start

# Atau mode development (auto-reload)
npm run dev
```

Buka browser Anda dan akses:
👉 **`http://localhost:3000`**

---

## 📡 Dokumentasi API & Integrasi

### 1. Upload File (Standard REST API)
```bash
curl -F "files=@screenshot.png" http://localhost:3000/api/upload
```
**Response JSON:**
```json
{
  "success": true,
  "files": [
    {
      "shortId": "x9a2b1",
      "name": "screenshot.png",
      "storedName": "x9a2b1.png",
      "url": "http://localhost:3000/x9a2b1.png",
      "size": 104230,
      "mimeType": "image/png"
    }
  ],
  "url": "http://localhost:3000/x9a2b1.png"
}
```

### 2. Upload dari URL
```bash
curl -X POST http://localhost:3000/api/upload-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/sample.jpg"}'
```

### 3. Support Me via Tako.id
- **Lihat Konfigurasi**: `GET /api/support/config`
- **Kirim Dukungan / Gift**:
  ```bash
  curl -X POST http://localhost:3000/api/support/create \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Budi",
      "email": "budi@example.com",
      "amount": 25000,
      "paymentMethod": "qris",
      "message": "Terima kasih Streamcal!"
    }'
  ```
- **Cek Status Pembayaran**: `GET /api/support/status/:giftId`
- **Daftar Pendukung Terbaru**: `GET /api/support/recent`
- **Webhook Notifikasi Tako**: `POST /api/support/webhook`

---

## 💖 Konfigurasi Dukungan Tako.id (https://tako.id/api-docs)

Streamcal mendukung sistem donasi & apresiasi langsung menggunakan **Tako.id API**:
1. Buat akun dan ambil Personal API Key di [Tako API Keys](https://tako.id/me/api-keys).
2. Tambahkan pengaturan ke file `.env`:
   ```env
   TAKO_API_KEY=personal_api_key_anda
   TAKO_USERNAME=username_tako_anda
   TAKO_WEBHOOK_SECRET=secret_webhook_opsional
   ```
3. Metode pembayaran yang didukung otomatis: **QRIS**, **GoPay**, **DANA**, dan **PayPal / Kartu Kredit**.
4. Website akan menyediakan formulir donasi elegan lengkap dengan preset nominal, input custom, verifikasi status transaksi realtime, serta *Hall of Supporters* otomatis.

---

## 🔒 Privasi & Keamanan Publik

- **Bebas Watermark**: UI publik bersih tanpa logo/watermark pihak ketiga atau sistem database internal.
- **Direct Link**: Semua link file dapat langsung diakses publik dan di-embed ke forum, website, atau Discord.
- **Zero Credentials Exposure**: File konfigurasi `.env` dan direktori upload otomatis terproteksi oleh `.gitignore`.


