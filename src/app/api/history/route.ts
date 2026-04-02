import { getDb, type Conversation, type Session } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await getDb().execute({
      sql: "SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at ASC",
      args: [userId],
    });

    const conversations: Conversation[] = result.rows.map((row) => ({
      id: row.id as string,
      session_id: (row.session_id as string) ?? (row.id as string),
      user_id: row.user_id as string,
      question: row.question as string,
      answer: row.answer as string,
      sources: JSON.parse(row.sources as string),
      created_at: row.created_at as string,
    }));

    // session_id でグルーピング
    const sessionMap = new Map<string, Conversation[]>();
    for (const conv of conversations) {
      const key = conv.session_id;
      if (!sessionMap.has(key)) sessionMap.set(key, []);
      sessionMap.get(key)!.push(conv);
    }

    const sessions: Session[] = Array.from(sessionMap.entries())
      .map(([session_id, messages]) => ({
        session_id,
        title: messages[0].question,
        messages,
        created_at: messages[0].created_at,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    return Response.json(sessions);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
