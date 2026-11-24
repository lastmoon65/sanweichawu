export interface PendingIdempotency {
  readonly key: string;
  readonly signature: string;
}

let keySequence = 0;

export function generateIdempotencyKey(
  now = Date.now(),
  random: () => number = Math.random,
): string {
  keySequence = (keySequence + 1) % 1_679_616;
  const randomPart = Math.floor(random() * 1_000_000_000)
    .toString(36)
    .padStart(6, '0');
  return `wx-${now.toString(36)}-${randomPart}-${keySequence.toString(36)}`;
}

export function resolvePendingIdempotency(
  previous: Partial<PendingIdempotency> | undefined,
  signature: string,
  createKey: () => string = generateIdempotencyKey,
): PendingIdempotency {
  if (previous?.key && previous.signature === signature) {
    return { key: previous.key, signature };
  }
  return { key: createKey(), signature };
}
