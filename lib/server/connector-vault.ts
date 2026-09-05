import { database, secrets } from './db';
const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const base64 = (b: Uint8Array) => {
  let out = '';
  for (let i = 0; i < b.length; i += 16384)
    out += String.fromCharCode(...b.subarray(i, i + 16384));
  return btoa(out);
};
const encoder = new TextEncoder();
export function vaultReady() {
  return !!secrets().CONNECTOR_ENCRYPTION_KEY;
}
async function encryptionKey() {
  const raw = secrets().CONNECTOR_ENCRYPTION_KEY;
  if (!raw || bytes(raw).length !== 32)
    throw new Error('INPUT:Secure connection storage is not configured.');
  return crypto.subtle.importKey('raw', bytes(raw), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}
export async function seal(value: unknown, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(context) },
    await encryptionKey(),
    encoder.encode(JSON.stringify(value)),
  );
  return base64(iv) + '.' + base64(new Uint8Array(encrypted));
}
export async function unseal<T>(value: string, context: string): Promise<T> {
  const [iv, cipher] = value.split('.');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes(iv), additionalData: encoder.encode(context) },
    await encryptionKey(),
    bytes(cipher),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
export async function readVault<T>(
  owner: string,
  kind: string,
  provider: string,
): Promise<T | null> {
  const row = await database()
    .prepare(
      'SELECT encrypted FROM connector_vault WHERE owner=? AND kind=? AND provider=?',
    )
    .bind(owner, kind, provider)
    .first<{ encrypted: string }>();
  return row ? unseal<T>(row.encrypted, `${owner}:${kind}:${provider}`) : null;
}
export async function writeVault(
  owner: string,
  kind: string,
  provider: string,
  value: unknown,
) {
  const encrypted = await seal(value, `${owner}:${kind}:${provider}`);
  await database()
    .prepare(
      'INSERT INTO connector_vault(owner,kind,provider,encrypted,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,kind,provider) DO UPDATE SET encrypted=excluded.encrypted,updated_at=excluded.updated_at',
    )
    .bind(owner, kind, provider, encrypted, new Date().toISOString())
    .run();
}
export function randomToken() {
  return base64(crypto.getRandomValues(new Uint8Array(32)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
export async function digest(value: string) {
  return base64(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', encoder.encode(value)),
    ),
  )
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
