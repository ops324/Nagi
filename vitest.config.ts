import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 純ロジック（lib/）の単体テスト用。React コンポーネントは対象外のため
// jsdom / testing-library は導入していない（必要になった時点で追加する）。
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    // generate-comment.ts は import 時に Anthropic クライアントを生成するため、
    // ダミーの API キーを与えておく（テストでは API 呼び出し自体をモックする）。
    env: {
      ANTHROPIC_API_KEY: "test-key",
    },
  },
  resolve: {
    alias: {
      // tsconfig.json の "@/*": ["./*"] と揃える
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
