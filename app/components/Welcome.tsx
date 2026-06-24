"use client";

import Image from "next/image";
import * as RadixDialog from "@radix-ui/react-dialog";
import { ABOUT_INTRO, ABOUT_FIRST_STEP } from "../lib/about";
import { spawnRipple } from "../lib/ripple";

export interface WelcomeProps {
  /** 表示状態（記録 0 件時に true） */
  open: boolean;
  /** 開閉状態の更新（「はじめる」や外側操作で閉じる） */
  onOpenChange: (open: boolean) => void;
}

/**
 * 初回ウェルカム画面（記録 0 件時のフルスクリーンダイアログ）。
 * HomeClient から切り出した表示専用コンポーネント。挙動・見た目は従来と不変。
 */
export default function Welcome({ open, onOpenChange }: WelcomeProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 welcome-fade-in focus:outline-none"
          style={{ backgroundColor: "var(--bg)" }}
        >
          <div className="w-14 h-14 mb-6 rounded-2xl overflow-hidden">
            <Image src="/icon-nagi.png" alt="Nagi" width={56} height={56} priority className="w-14 h-14 block" />
          </div>
          <RadixDialog.Title className="text-sm tracking-widest mb-5"
            style={{ color: "var(--text-muted)" }}>凪へ ようこそ</RadixDialog.Title>

          <p className="text-xs leading-loose max-w-[300px] text-center"
            style={{ color: "var(--text-secondary)" }}>
            {ABOUT_INTRO}
          </p>

          <div className="mt-6 mx-auto max-w-[300px] pt-5"
            style={{ borderTop: "1px solid var(--border-inner)" }}>
            <p className="text-xs tracking-widest mb-2 text-center"
              style={{ color: "var(--text-muted)" }}>最初の一歩</p>
            <p className="text-xs leading-loose text-center"
              style={{ color: "var(--text-secondary)" }}>
              {ABOUT_FIRST_STEP}
            </p>
          </div>

          <RadixDialog.Close asChild>
            <button
              onPointerDown={spawnRipple}
              className="btn-primary mt-10 text-xs tracking-widest px-8 py-3 rounded-full"
              style={{ backgroundColor: "var(--green)", color: "var(--color-btn-text)" }}
            >
              はじめる
            </button>
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
