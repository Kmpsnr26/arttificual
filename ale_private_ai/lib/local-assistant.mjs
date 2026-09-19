const MAX_HISTORY_ITEMS = 12;

export function cleanMessage(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim().slice(0, 4000);
}

export function cleanHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: cleanMessage(item?.content),
    }))
    .filter((item) => item.content);
}

function offlineReply(message, now = new Date()) {
  const text = message.toLocaleLowerCase('id-ID');
  const jakarta = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(now);

  if (/\b(halo|hai|hello|assalamualaikum)\b/.test(text)) {
    return 'Halo, saya ALE. Mode lokal aktif dan seluruh percakapan ini diproses di perangkat Anda.';
  }
  if (/\b(jam|waktu|tanggal|hari)\b/.test(text)) {
    return `Waktu Jakarta sekarang ${jakarta}.`;
  }
  if (/\b(status|koneksi|mode|online|offline)\b/.test(text)) {
    return 'ALE berjalan dalam mode lokal. Saya akan memakai Ollama otomatis jika layanannya tersedia; jika tidak, mesin respons offline tetap aktif.';
  }
  if (/\b(privasi|aman|keamanan|kamera|mikrofon)\b/.test(text)) {
    return 'Kamera dan mikrofon hanya aktif setelah izin diberikan. Tombol privasi akan menghentikan seluruh stream media yang sedang berjalan.';
  }
  if (/\b(bantuan|bantu|fitur|bisa apa)\b/.test(text)) {
    return 'Saya dapat memeriksa status lokal, memberi informasi waktu, menjelaskan pengaturan privasi, dan terhubung ke model Ollama ketika tersedia. Mode cloud dapat ditambahkan melalui backend tanpa menaruh key di browser.';
  }
  if (/\b(nama|siapa kamu)\b/.test(text)) {
    return 'Nama saya ALE, private AI human untuk perangkat Anda.';
  }

  return `Saya menerima pesan Anda secara lokal: “${message.slice(0, 240)}”. Agar jawaban lebih bebas dan mendalam, jalankan Ollama; ALE akan mendeteksinya secara otomatis.`;
}

async function ollamaReply({ message, history, ollamaUrl, model, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'Anda adalah ALE, asisten AI privat berbahasa Indonesia. Jawab ringkas, jelas, hangat, dan jangan mengaku melakukan tindakan yang belum dilakukan.',
          },
          ...cleanHistory(history),
          { role: 'user', content: message },
        ],
        options: { temperature: 0.45 },
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const data = await response.json();
    const reply = cleanMessage(data?.message?.content);
    if (!reply) throw new Error('Ollama mengembalikan jawaban kosong');
    return reply;
  } finally {
    clearTimeout(timer);
  }
}

export async function answerLocally({
  message,
  history = [],
  provider = 'auto',
  ollamaUrl = 'http://127.0.0.1:11434',
  model = 'qwen2.5:1.5b',
  timeoutMs = 45000,
} = {}) {
  const cleaned = cleanMessage(message);
  if (!cleaned) {
    const error = new Error('Pesan tidak boleh kosong.');
    error.statusCode = 400;
    throw error;
  }

  if (provider !== 'offline') {
    try {
      const reply = await ollamaReply({
        message: cleaned,
        history,
        ollamaUrl,
        model,
        timeoutMs,
      });
      return { reply, provider: 'ollama', model };
    } catch (error) {
      if (provider === 'ollama') {
        const unavailable = new Error('Ollama belum tersedia. Jalankan Ollama atau pilih mode Otomatis/Offline.');
        unavailable.statusCode = 503;
        unavailable.cause = error;
        throw unavailable;
      }
    }
  }

  return {
    reply: offlineReply(cleaned),
    provider: 'offline',
    model: 'ale-local-rules-v1',
  };
}

