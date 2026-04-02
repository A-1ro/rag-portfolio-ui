/**
 * DBマイグレーションスクリプト
 *
 * 使い方:
 *   npm run migrate
 *
 * .env.local の TURSO_DB_URL / TURSO_DB_AUTH_TOKEN を使って接続します。
 * このスクリプトはローカルから直接実行してください。HTTPエンドポイントは存在しません。
 */
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_DB_AUTH_TOKEN!,
});

if (!process.env.TURSO_DB_URL || !process.env.TURSO_DB_AUTH_TOKEN) {
  console.error("Error: TURSO_DB_URL and TURSO_DB_AUTH_TOKEN must be set.");
  console.error("Run `vercel env pull .env.local` to fetch them.");
  process.exit(1);
}

const migrations = [
  {
    name: "add_session_id_to_conversations",
    sql: "ALTER TABLE conversations ADD COLUMN session_id TEXT",
  },
];

for (const migration of migrations) {
  try {
    await db.execute({ sql: migration.sql, args: [] });
    console.log(`✓ ${migration.name}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("duplicate column")) {
      console.log(`- ${migration.name} (already applied)`);
    } else {
      console.error(`✗ ${migration.name}: ${message}`);
      process.exit(1);
    }
  }
}

console.log("Migration complete.");
