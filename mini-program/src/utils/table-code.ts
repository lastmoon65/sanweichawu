const MAX_TABLE_CODE_LENGTH = 40;

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function parseTableCode(content: string): string | null {
  const input = content.trim();
  if (input.length === 0 || input.length > 500) {
    return null;
  }

  const queryMatch = /[?&](?:tableCode|table|code)=([^&#]+)/i.exec(input);
  const pathMatch = /(?:^|\/)(?:tables?|tableCode)\/([^/?#]+)/i.exec(input);
  const encodedCandidate = queryMatch?.[1] ?? pathMatch?.[1] ?? input;
  const candidate = safeDecode(encodedCandidate)?.trim() ?? '';
  if (
    candidate.length === 0 ||
    candidate.length > MAX_TABLE_CODE_LENGTH ||
    /\s/.test(candidate) ||
    /[/?#]/.test(candidate)
  ) {
    return null;
  }
  return candidate;
}
