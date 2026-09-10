import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('apps/contentpreview/components/ysabel-workspace.tsx', 'utf8');
const start = source.indexOf('  useEffect(() => {\n    let cancelled = false;\n    setConnectionError');
const effect = source.slice(start, source.indexOf('  }, [connectionAttempt]);', start) + '  }, [connectionAttempt]);'.length);

async function restore({ token = 'saved-session', status = 200, data = { boards: [] }, fail = false } = {}) {
  const state = { auth: 'checking', cleared: false, error: '', request: null };
  vm.runInNewContext(effect, {
    Headers, connectionAttempt: 0,
    useEffect: (callback) => callback(),
    readSessionToken: () => token,
    setAuthToken: () => {},
    storeSessionToken: value => { state.stored = value; },
    setConnectionError: (value) => { state.error = value; },
    setAuthState: (value) => { state.auth = value; },
    clearSessionToken: () => { state.cleared = true; },
    fetch: async (url, options) => {
      state.request = { url, authorization: options.headers.get('authorization') };
      if (fail) throw new Error('Offline');
      return { status, ok: status >= 200 && status < 300, json: async () => data };
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  return state;
}

test('refresh restores a saved bearer session through the protected workspace', async () => {
  const state = await restore();
  assert.equal(state.auth, 'ready');
  assert.equal(state.cleared, false);
  assert.equal(state.request.authorization, 'Bearer saved-session');
});
test('expired session returns to login and clears the rejected token', async () => {
  const state = await restore({ status: 401 });
  assert.equal(state.auth, 'login');
  assert.equal(state.cleared, true);
});
test('offline, server failures and malformed responses keep the token and offer retry', async () => {
  for (const options of [{ fail: true }, { status: 503 }, { data: {} }]) {
    const state = await restore(options);
    assert.equal(state.auth, 'checking');
    assert.equal(state.cleared, false);
    assert.ok(state.error);
  }
});
test('a first visit still requires confirmed authentication', async () => {
  assert.equal((await restore({ token: '', data: { authenticated: false } })).auth, 'login');
});

test('cookie-only sessions recover their verified token for direct uploads', async () => {
  const state = await restore({ token: '', data: { authenticated: true, token: 'verified-cookie-token' } });
  assert.equal(state.auth, 'ready');
  assert.equal(state.stored, 'verified-cookie-token');
});
