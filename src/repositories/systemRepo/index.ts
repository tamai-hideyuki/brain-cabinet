import { db } from "../../db/client";
import { sql } from "drizzle-orm";

/**
 * テーブルの行数を取得
 */
export const countTableRows = async (tableName: string): Promise<number> => {
  const result = await db.all<{ count: number }>(
    sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`)
  );
  return result[0]?.count ?? 0;
};

/**
 * テーブルのBLOBカラムの合計サイズを取得
 */
export const sumBlobColumnSizes = async (
  tableName: string,
  blobColumns: string[]
): Promise<number> => {
  const sizeExpressions = blobColumns
    .map((col) => `COALESCE(SUM(LENGTH(${col})), 0)`)
    .join(" + ");
  const result = await db.all<{ size: number }>(
    sql.raw(`SELECT (${sizeExpressions}) as size FROM ${tableName}`)
  );
  return Number(result[0]?.size ?? 0);
};
