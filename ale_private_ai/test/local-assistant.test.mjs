import assert from 'node:assert/strict';
import test from 'node:test';
import { answerLocally, cleanHistory, cleanMessage } from '../lib/local-assistant.mjs';

test('cleanMessage membatasi input dan menghapus null byte', () => {
  assert.equal(cleanMessage('  halo\u0000  '), 'halo');
  assert.equal(cleanMessage(123), '');
  assert.equal(cleanMessage('x'.repeat(5000)).length, 4000);
});

test('cleanHistory hanya menyimpan role dan item terakhir yang valid', () => {
  const history = Array.from({ length: 15 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    content: `pesan ${index}`,
    secret: 'tidak ikut',
  }));
  const result = cleanHistory(history);
  assert.equal(result.length, 12);
  assert.deepEqual(Object.keys(result[0]), ['role', 'content']);
  assert.equal(result[0].content, 'pesan 3');
});

test('mode offline memberi jawaban tanpa jaringan', async () => {
  const result = await answerLocally({ message: 'Apa status koneksi?', provider: 'offline' });
  assert.equal(result.provider, 'offline');
  assert.match(result.reply, /mode lokal/i);
});

test('pesan kosong ditolak dengan status 400', async () => {
  await assert.rejects(
    () => answerLocally({ message: '   ', provider: 'offline' }),
    (error) => error.statusCode === 400,
  );
});

