# ALE Private AI Human

ALE adalah widget digital human privat untuk browser/PWA dan desktop. Versi 0.2.0 sudah mempunyai backend Node lokal, mode percakapan offline, dukungan Ollama opsional, kontrol kamera/mikrofon, serta wrapper Electron always-on-top.

## Yang sudah berfungsi

- Wajah female/male berbasis canvas dengan eye tracking, head tracking, auto blink, dan lip sync.
- Bug auto blink yang sebelumnya dapat mengunci mata dalam keadaan tertutup sudah diperbaiki.
- Mode privasi benar-benar menghentikan kamera, mikrofon, audio analyser, dan stream media.
- Pengaturan tampilan, posisi widget, pilihan provider, dan riwayat chat tersimpan lokal.
- Backend dan frontend berjalan dari satu origin sehingga tidak memerlukan CORS terbuka.
- Payload JSON dibatasi, path traversal ditolak, dan header keamanan dasar diaktifkan.
- Mode `offline` selalu tersedia tanpa internet.
- Mode `auto` mencoba Ollama lalu berpindah ke offline jika Ollama belum berjalan.
- Service worker tidak lagi menyimpan respons API dan membersihkan cache versi lama.
- Electron menyalakan backend sendiri pada port acak sebelum membuka widget.

## Menjalankan web lokal

Persyaratan: Node.js 20 atau lebih baru.

```powershell
node server.mjs
```

Buka `http://127.0.0.1:8080`.

Untuk menjalankan pemeriksaan:

```powershell
node --check server.mjs
node --check web/app.js
node --test
```

## Mode AI lokal

Tanpa Ollama, ALE memakai mesin respons offline bawaan. Untuk jawaban model lokal yang lebih bebas, pasang Ollama lalu sediakan model yang sesuai dengan `.env.example`:

```powershell
ollama pull qwen2.5:1.5b
ollama serve
```

ALE mendeteksi endpoint `http://127.0.0.1:11434` secara otomatis. Nilai dapat diubah melalui `.env.local`:

```dotenv
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:1.5b
```

## Desktop floating

```powershell
cd desktop
npm install
npm start
```

Shortcut hide/show: `Ctrl+Shift+A` pada Windows/Linux atau `Cmd+Shift+A` pada macOS.

## Struktur keamanan cloud

- Source code disimpan di repositori GitHub privat.
- Secret provider AI disimpan di secret manager backend, bukan di GitHub atau JavaScript.
- Browser, PWA, dan Electron hanya memanggil backend HTTPS.
- Setiap akun pengguna memperoleh akses melalui identitasnya sendiri; key tidak dibagikan melalui chat atau email.

Mode OpenAI masih dinonaktifkan sampai secret backend berhasil dibuat dan disimpan melalui alur aman. Opsi tersebut sengaja tidak menerima key dari browser.

## Batasan platform

PWA dapat mengambang hanya di dalam halaman browser. Overlay di atas aplikasi lain pada desktop memakai Electron. Overlay lintas aplikasi pada Android memerlukan aplikasi native dan izin OS khusus.

