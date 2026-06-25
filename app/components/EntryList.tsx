"use client";

import { Entry, Emotion, EMOTION_COLORS } from "../types";
import EntryCard from "./EntryCard";
import { spawnRipple } from "../lib/ripple";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

/**
 * EntryList — 記録一覧＋インライン編集
 *
 * HomeClient から切り出した記録タブの一覧ブロック（旧 617〜833 行の IIFE）。
 * - searchQuery（全文検索）＋ filterKey（感情フィルター）で entries を絞り込み
 * - editingId === entry.id のときはインライン編集 UI（textarea＋「凪に読みなおして
 *   もらう」トグル＋保存/やめる＋編集中ローディング）を表示、それ以外は EntryCard
 * - EntryCard の menuSlot に削除確認 UI / ⋯メニュー（編集する・削除する）を差し込む
 * - 該当 0 件時は空状態メッセージ（検索/フィルタ有無で出し分け）
 *
 * state はすべて HomeClient に残置し、本コンポーネントは値＋コールバックを props で
 * 受け取る presentational コンポーネント（純粋ツリー抽出・挙動は完全不変）。
 */
export interface EntryListProps {
  // 一覧・絞り込み
  entries: Entry[];
  searchQuery: string;
  filterKey: string | null;
  loading: boolean;
  // 表示補助
  emotionGradient: (emotions: Emotion[]) => string;
  notes: Record<string, string>;
  savedNoteIds: Set<string>;
  highlightedEntryId: string | null;
  newEntryId: string | null;
  // お気に入り / 余韻メモ
  onToggleFavorite: (id: string) => void;
  onNoteChange: (id: string, value: string) => void;
  // 編集
  editingId: string | null;
  editingText: string;
  editSaving: boolean;
  editError: string;
  regenerateOnEdit: boolean;
  onEditTextChange: (value: string) => void;
  onRegenerateToggle: () => void;
  onEditStart: (entry: Entry) => void;
  onEditCancel: () => void;
  onEditSave: (id: string) => void;
  // 削除
  deletingId: string | null;
  onDeleteRequest: (id: string) => void;
  onDeleteCancel: () => void;
  onDelete: (id: string) => void;
}

export default function EntryList({
  entries,
  searchQuery,
  filterKey,
  loading,
  emotionGradient,
  notes,
  savedNoteIds,
  highlightedEntryId,
  newEntryId,
  onToggleFavorite,
  onNoteChange,
  editingId,
  editingText,
  editSaving,
  editError,
  regenerateOnEdit,
  onEditTextChange,
  onRegenerateToggle,
  onEditStart,
  onEditCancel,
  onEditSave,
  deletingId,
  onDeleteRequest,
  onDeleteCancel,
  onDelete,
}: EntryListProps) {
  const q = searchQuery.trim().toLowerCase();
  const filteredEntries = entries
    .filter(e =>
      filterKey === null ? true
      : filterKey === "✦" ? e.isFavorited
      : filterKey === "deep" ? e.insightLevel === "deep"
      : e.emotions?.some(em => em.label === filterKey)
    )
    .filter(e =>
      q === "" ? true
      : (e.content?.toLowerCase().includes(q) ||
         e.comment?.toLowerCase().includes(q) ||
         e.note?.toLowerCase().includes(q))
    );

  return filteredEntries.length > 0 ? (
    <div className="space-y-4">
      {filteredEntries.map((entry, entryIndex) => {
        // 編集モード: EntryCard の代わりにインライン編集UIを表示
        if (editingId === entry.id) {
          return (
            <div
              key={entry.id}
              id={`entry-${entry.id}`}
              className="rounded-3xl p-[27px] space-y-4"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              {editSaving ? (
                <div className="h-32 flex flex-col items-center justify-center gap-4">
                  <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
                    <div className="loading-ring" style={{ animationDelay: "0s" }} />
                    <div className="loading-ring" style={{ animationDelay: "0.87s" }} />
                    <div className="loading-ring" style={{ animationDelay: "1.73s" }} />
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: "var(--green)", opacity: 0.7 }} />
                  </div>
                  <p className="text-xs tracking-widest" style={{ color: "var(--text-muted)" }}>
                    凪が読みなおしています
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={editingText}
                    onChange={(e) => onEditTextChange(e.target.value)}
                    maxLength={5000}
                    autoFocus
                    rows={6}
                    className="w-full text-sm resize-none outline-none leading-relaxed rounded-2xl p-3"
                    style={{
                      color: "var(--text-primary)",
                      backgroundColor: "var(--bg)",
                      border: "1px solid var(--border)",
                    }}
                    aria-label="記録を編集"
                  />
                  {editError && <p className="text-xs" style={{ color: "#fca5a5" }}>{editError}</p>}
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={regenerateOnEdit}
                      onClick={() => onRegenerateToggle()}
                      className="flex items-center gap-2.5 text-xs"
                      style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: "34px",
                          height: "20px",
                          borderRadius: "9999px",
                          padding: "2px",
                          backgroundColor: regenerateOnEdit ? "var(--green)" : "var(--bg-disabled)",
                          display: "flex",
                          justifyContent: regenerateOnEdit ? "flex-end" : "flex-start",
                          transition: "background-color 0.2s ease",
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#fff" }} />
                      </span>
                      凪に読みなおしてもらう
                    </button>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {regenerateOnEdit
                        ? "凪のことばは、読みなおすと新しくなります"
                        : "凪のことばは、そのまま残ります"}
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={onEditCancel}
                      className="text-xs tracking-widest px-4 py-2 rounded-full"
                      style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    >
                      やめる
                    </button>
                    {(() => {
                      const disabled = !editingText.trim()
                        || editingText.trim() === entry.content.trim();
                      return (
                        <button
                          onClick={() => onEditSave(entry.id)}
                          onPointerDown={spawnRipple}
                          disabled={disabled}
                          className="btn-primary text-xs tracking-widest px-5 py-2 rounded-full"
                          style={{
                            backgroundColor: disabled ? "var(--bg-disabled)" : "var(--green)",
                            color:           disabled ? "var(--text-disabled)" : "var(--color-btn-text)",
                            cursor:          disabled ? "not-allowed" : "pointer",
                          }}
                        >
                          保存する
                        </button>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          );
        }

        // 通常モード: EntryCard コンポーネント
        return (
          <EntryCard
            key={entry.id}
            domId={`entry-${entry.id}`}
            entry={{ ...entry, note: notes[entry.id] ?? entry.note ?? "" }}
            emotionGradient={emotionGradient}
            EMOTION_COLORS={EMOTION_COLORS}
            onToggleFavorite={onToggleFavorite}
            onNoteChange={onNoteChange}
            noteSaved={savedNoteIds.has(entry.id)}
            highlighted={highlightedEntryId === entry.id}
            isNew={newEntryId === entry.id}
            index={entryIndex}
            menuSlot={
              deletingId === entry.id ? (
                <div className="flex items-center gap-2" role="group" aria-live="polite" aria-label="削除確認">
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="text-xs tracking-widest px-4 py-2 rounded-full transition-colors"
                    style={{ backgroundColor: "#fca5a530", color: "#ef4444", border: "1px solid #fca5a5" }}
                  >
                    削除する
                  </button>
                  <button
                    onClick={() => onDeleteCancel()}
                    className="text-xs tracking-widest px-4 py-2 rounded-full"
                    style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                  >
                    やめる
                  </button>
                </div>
              ) : (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      className="btn-ghost flex items-center justify-center w-11 h-11 -mr-2 rounded-full"
                      style={{ color: "var(--text-muted)" }}
                      aria-label="この記録のメニュー"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="3" cy="8" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="13" cy="8" r="1.5" />
                      </svg>
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={4}
                      className="z-30 rounded-2xl overflow-hidden"
                      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", minWidth: "120px", boxShadow: "var(--shadow-3)" }}
                    >
                      <DropdownMenu.Item
                        onSelect={() => onEditStart(entry)}
                        className="min-h-[44px] px-5 flex items-center text-xs tracking-widest cursor-pointer outline-none transition-colors hover:bg-[var(--state-hover)] data-[highlighted]:bg-[var(--state-hover)]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        編集する
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className="h-px" style={{ backgroundColor: "var(--border)" }} />
                      <DropdownMenu.Item
                        onSelect={() => onDeleteRequest(entry.id)}
                        className="min-h-[44px] px-5 flex items-center text-xs tracking-widest cursor-pointer outline-none transition-colors hover:bg-[var(--state-hover)] data-[highlighted]:bg-[var(--state-hover)]"
                        style={{ color: "#ef4444" }}
                      >
                        削除する
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              )
            }
          />
        );
      })}
    </div>
  ) : (
    !loading && (
      filterKey !== null || searchQuery ? (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: "var(--text-subtle)" }}>該当する記録はありません</p>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: "var(--text-subtle)" }}>まだ記録がありません</p>
        </div>
      )
    )
  );
}
