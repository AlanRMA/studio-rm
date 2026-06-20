import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

export type AdjustmentKind = 'increase' | 'discount' | 'none';

export function getAdjustmentKind(adjustment: number): AdjustmentKind {
  if (!adjustment || adjustment === 0) return 'none';
  return adjustment < 0 ? 'discount' : 'increase';
}

export function getAdjustmentMagnitude(adjustment: number): number {
  return Math.abs(adjustment || 0);
}

export function applyAdjustmentSign(magnitude: number, kind: AdjustmentKind): number {
  if (kind === 'none') return 0;
  const value = Math.abs(magnitude || 0);
  return kind === 'discount' ? -value : value;
}

export function formatSignedAdjustment(adjustment: number): string {
  const kind = getAdjustmentKind(adjustment);
  if (kind === 'none') return formatCurrency(0);
  const magnitude = getAdjustmentMagnitude(adjustment);
  const formatted = formatCurrency(magnitude);
  return kind === 'increase' ? `+ ${formatted}` : `- ${formatted}`;
}

export function roundToNearestTenCents(amount: number) {
  return Math.round(amount * 10) / 10;
}

function uuidFromRandom(random: () => number): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const randomNibble = Math.floor(random() * 16);
    if (char === 'x') return randomNibble.toString(16);
    return ((randomNibble & 0x3) | 0x8).toString(16);
  });
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return uuidFromRandom(() => crypto.getRandomValues(new Uint8Array(1))[0] / 255);
  }

  return uuidFromRandom(() => Math.random());
}
