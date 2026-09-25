import type { AppCategory } from './types';

// Palette carried over from the Node-RED dashboard.
export const COLORS = {
  primary: '#2980b9',
  primaryAlt: '#0273dd',
  accent: '#ffcf00',
  ok: '#27ae60',
  warn: '#f39c12',
  error: '#c0392b',
  strategis: '#8e44ad',
  muted: '#95a5a6',
};

export const APP_CATEGORIES: Exclude<AppCategory, ''>[] = ['Strategis', 'Tinggi', 'Sedang', 'Rendah'];
export const UNLABELED = 'Belum Berlabel';

export const CATEGORY_COLORS: Record<string, string> = {
  Strategis: COLORS.strategis,
  Tinggi: COLORS.error,
  Sedang: COLORS.warn,
  Rendah: COLORS.primary,
  [UNLABELED]: COLORS.muted,
};

// Note categories offered in every NoteEditor. Edit this list to match the
// categories used in the Node-RED dashboard.
export const NOTE_CATEGORIES = ['Sudah Dihubungi Tim Aplikasi', 'Investigasi Berjalan', 'Menunggu Perbaikan', 'Lainnya'];

export const REFRESH_MS = 5 * 60 * 1000;
