export function getReceiptApiUrl(): string {
  const raw = process.env.RECEIPT_API_URL ?? 'http://localhost:4000';
  return raw.replace(/\/+$/, '');
}

export function getReceiptApiKey(): string {
  return process.env.RECEIPT_API_KEY ?? '';
}

export function receiptApiPath(path: string): string {
  const base = getReceiptApiUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}