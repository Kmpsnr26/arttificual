import assert from 'node:assert/strict';
import test from 'node:test';
import { startServer } from '../server.mjs';

async function withServer(run) {
  const { server, url } = await startServer({ port: 0, log: false });
  try {
    await run(url);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('health endpoint melaporkan mode lokal', async () => {
  await withServer(async (url) => {
    const response = await fetch(`${url}/api/health`);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.mode, 'local');
  });
});

test('chat offline mengembalikan provider yang benar', async () => {
  await withServer(async (url) => {
    const response = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Halo', provider: 'offline' }),
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, 'offline');
    assert.match(data.reply, /ALE/);
  });
});

test('JSON rusak dan path traversal ditolak', async () => {
  await withServer(async (url) => {
    const badJson = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    assert.equal(badJson.status, 400);

    const traversal = await fetch(`${url}/..%2FREADME.md`);
    assert.equal(traversal.status, 404);
  });
});

