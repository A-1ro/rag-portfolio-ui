import { getDb, type Conversation } from "@/lib/db";

export async function GET() {
  try {
    const result = await getDb().execute(
      "SELECT * FROM conversations ORDER BY created_at DESC LIMIT 50"
    );

    const conversations: Conversation[] = result.rows.map((row) => ({
      id: row.id as string,
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
