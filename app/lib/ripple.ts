import type { PointerEvent } from "react";

/**
 * クリック/タップ位置から波紋（ripple）を生成する。
 * 対象ボタンは `position: relative; overflow: hidden`（.btn-primary / .btn-ghost が付与）
 * であることを前提とする。CSS の `.ripple-ink` がアニメーションを担う。
 * prefers-reduced-motion 時は CSS 側でアニメーションを無効化する。
 */
export function spawnRipple(e: PointerEvent<HTMLElement>) {
  const host = e.currentTarget;
  // 無効化されたボタンでは波紋を出さない
  if (host.hasAttribute("disabled")) return;
  const rect = host.getBoundingClientRect();
  const ink = document.createElement("span");
  ink.className = "ripple-ink";
  ink.style.left = `${e.clientX - rect.left}px`;
  ink.style.top = `${e.clientY - rect.top}px`;
  host.appendChild(ink);
  ink.addEventListener("animationend", () => ink.remove());
}
