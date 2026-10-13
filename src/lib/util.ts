import type { Lang } from '../data/catalog';

export const uuid = () =>
  'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

const locale = (lang: Lang) => (lang === 'de' ? 'de-DE' : 'en-GB');

export const fmtTime = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' });

export const fmtDate = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleDateString(locale(lang), { day: '2-digit', month: '2-digit', year: 'numeric' });

export const fmtDateShort = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleDateString(locale(lang), { weekday: 'short', day: 'numeric', month: 'short' });

/** "2026-10-13" for <input type=date> in local time. */
export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const toTimeInput = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
/** Combine local date + time inputs into an ISO timestamp. */
export const fromInputs = (date: string, time: string) => new Date(`${date}T${time || '00:00'}`).toISOString();

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = Array.isArray(v) ? v.join('|') : String(v);
    return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n');
}
