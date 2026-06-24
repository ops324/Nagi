import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // ローカル専用ディレクトリ（git 未追跡）。lint 対象外にする。
    // .claude/worktrees にはプロジェクトの複製が多数あり、これを lint すると
    // 数万件の問題が報告されてしまうため必須。
    ".claude/**",
    "supabase/**",
    "test-results/**",
    "coverage/**",
  ]),
  // 注: react-hooks v6 系の set-state-in-effect / purity は v1.60.0 で一時的に warn へ
  // 緩和していたが、フェーズ3（本対応）で実コードを修正済みのため既定の error に復帰した。
  // localStorage 復元の1箇所のみ HomeClient.tsx 内の eslint-disable で個別許容している。
]);

export default eslintConfig;
