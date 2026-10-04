import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Шифрование доступов: AES-256-GCM. В базе лежит одна строка —
 * base64(нонс 12 байт | метка 16 байт | шифротекст).
 *
 * `scope` (номер проекта) входит в проверяемые данные: строку нельзя
 * переставить в другой проект — расшифровка не сойдётся. Подмена
 * или порча строки тоже не пройдёт: GCM сверяет метку.
 */

export function parseKey(base64: string): Buffer {
  const key = Buffer.from(base64, 'base64');
  if (key.length !== 32) throw new Error('SECRETS_KEY — 32 байта в base64: openssl rand -base64 32');
  return key;
}

export function seal(key: Buffer, scope: string, text: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(scope));
  const body = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), body]).toString('base64');
}

/** null — строка испорчена, чужая или ключ не тот. */
export function unseal(key: Buffer, scope: string, sealed: string): string | null {
  try {
    const raw = Buffer.from(sealed, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(scope));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
