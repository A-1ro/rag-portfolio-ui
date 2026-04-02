import { getDb, type Conversation } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const isPreview = process.env.VERCEL_ENV === "preview";
  const session = await auth();
  const userId = session?.user?.id ?? (isPreview ? "preview" : null);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await getDb().execute({
      sql: "SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      args: [userId],
    });

    const conversations: Conversation[] = result.rows.map((row) => ({
      id: row.id as string,
      user_id: row.user_id as string,
      question: row.question as string,
      answer: row.answer as string,
      sources: JSON.parse(row.sources as string),
      created_at: row.created_at as string,
    }));

    return Response.json(conversations);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
