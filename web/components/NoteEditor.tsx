'use client';

import { useState } from 'react';
import { NOTE_CATEGORIES } from '@/lib/constants';
import { useSaveNote } from '@/lib/api';
import type { EntityType } from '@/lib/types';

/**
 * Inline note form for a host, group or verify app. Saving an empty note
 * deletes it (same as the old Node-RED "hapus catatan").
 */
export function NoteEditor({
  entityType,
  entityKey,
  note,
  category,
  onDone,
}: {
  entityType: EntityType;
  entityKey: string;
  note: string;
  category: string;
  onDone?: () => void;
}) {
  const [text, setText] = useState(note);
  const [cat, setCat] = useState(category);
  const save = useSaveNote();
  const dirty = text.trim() !== note.trim() || cat !== category;

  const submit = (value: string) =>
    save.mutate({ entity_type: entityType, entity_key: entityKey, note: value, category: cat }, { onSuccess: () => onDone?.() });

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <select className="input w-full" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategori catatan">
        <option value="">- Kategori catatan -</option>
        {[...new Set([...NOTE_CATEGORIES, ...(category ? [category] : [])])].map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <textarea
        className="input min-h-20 w-full"
        value={text}
        placeholder="Tulis catatan / tindak lanjut..."
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={!dirty || save.isPending} onClick={() => submit(text)}>
          {save.isPending ? 'Menyimpan...' : 'Simpan'}
        </button>
        {note && (
          <button className="btn" disabled={save.isPending} onClick={() => submit('')}>
            Hapus catatan
          </button>
        )}
        {onDone && (
          <button className="btn" onClick={onDone}>
            Batal
          </button>
        )}
        {save.isError && <span className="text-xs text-err">Gagal menyimpan: {save.error.message}</span>}
      </div>
    </div>
  );
}

/** Small read-only note preview. */
export function NoteText({ note, category }: { note: string; category: string }) {
  if (!note) return null;
  return (
    <p className="mt-1 text-xs text-ink-muted">
      {category && <span className="font-semibold">[{category}] </span>}
      {note}
    </p>
  );
}

export function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M13.6 2.6a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8l-9.9 9.9-4.2 1.2 1.2-4.2 9.1-10.7z" />
    </svg>
  );
}
