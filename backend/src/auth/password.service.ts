import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const MAX_MEMORY = 64 * 1024 * 1024;
const PREFIX = 'scrypt';

export const DUMMY_PASSWORD_HASH =
  'scrypt:16384:8:1:c3RhZmYtYXV0aC1kdW1teS1zYWx0:SqXt2HaJ7WAGoyWuSF3vEb59LBxkgbXR_j41LN61KRg';

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAX_MEMORY },
      (error, key) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(key);
      },
    );
  });
}

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await deriveKey(password, salt);
    return [
      PREFIX,
      String(SCRYPT_N),
      String(SCRYPT_R),
      String(SCRYPT_P),
      salt.toString('base64url'),
      key.toString('base64url'),
    ].join(':');
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split(':');
    if (parts.length !== 6 || parts[0] !== PREFIX) {
      return false;
    }

    const n = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) {
      return false;
    }

    try {
      const salt = Buffer.from(parts[4] ?? '', 'base64url');
      const expected = Buffer.from(parts[5] ?? '', 'base64url');
      if (salt.length === 0 || expected.length !== KEY_LENGTH) {
        return false;
      }

      const actual = await deriveKey(password, salt);
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
