/**
 * Vitest Global Setup
 *
 * テスト実行時に DB クライアントをモックする。
 *
 * 【Why】
 * - SQLite は並列テスト時にファイルロック競合を起こしやすい
 * - 実 DB へのアクセスを完全に遮断し、テストの安定性を担保する
 *
 * 【Scope】
 * - クエリの「形（チェーン）」のみを保証する
 * - データの中身や SQL の正当性は検証しない
 */
import { vi } from "vitest";

/**
 * クエリチェーン用モック生成ヘルパー
 *
 * 指定されたメソッド名の配列から、
 * 「呼び出し可能なチェーン構造」だけを再帰的に生成する。
 *
 * 例:
 *   chainMock(["from", "where", "orderBy"])
 *   → from().where().orderBy() が呼べるモック
 *
 * 【設計方針】
 * - 振る舞いではなく「形」をモックする
 * - 実行結果は常に固定値（デフォルト: []）
 */
function chainMock(
  methods: string[], 
  finalValue: unknown = [],
): ReturnType<typeof vi.fn> {
  // チェーンの終端では Promise を返す
  if (methods.length === 0) {
    return vi.fn().mockResolvedValue(finalValue);
  }

  const [first, ...rest] = methods;

  return vi.fn().mockReturnValue({
    [first]: chainMock(rest, finalValue),
  });
}

/**
 * Drizzle ORM 用の DB クライアントモックを生成する
 *
 * 【保証すること】
 * - アプリケーションコードで使用しているクエリチェーンが例外なく呼べる
 *
 * 【保証しないこと】
 * - SQL の内容
 * - データの整合性
 * - クエリ条件の正しさ
 */
function createMockDb() {
  return {
    // SELECT クエリ系
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: chainMock(["orderBy"]),
        orderBy: vi.fn().mockResolvedValue([]),
        leftJoin: chainMock(["where"]),
      }),
    }),

    // INSERT クエリ系
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
        onConflictDoUpdate: chainMock(["returning"]),
        onConflictDoNothing: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      }),
    }),

    // UPDATE クエリ系
    update: vi.fn().mockReturnValue({
      set: chainMock(["where", "returning"]),
    }),

    // DELETE クエリ系
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
    }),

    // 単発取得・実行系
    all: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
  };
}

/**
 * DB クライアントをグローバルにモックする
 *
 * - 実際の DB ファイルには一切アクセスしない
 * - すべてのテストで同一のモックが使用される
 */
vi.mock("./src/db/client", () => ({ 
  db: createMockDb(),
}));
