import { getDb } from "@/lib/db";
import { auth } from "@/auth";

// session_id カラムの追加マイグレーション
// 初回デプロイ後に GET /api/migrate を一度だけ実行する
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await getDb().execute({
      sql: "ALTER TABLE conversations ADD COLUMN session_id TEXT",
      args: [],
    });
    return Response.json({ ok: true, message: "session_id column added" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // カラムが既に存在する場合は成功扱い
    if (message.includes("duplicate column")) {
      return Response.json({ ok: true, message: "already migrated" });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
