import { db, type Conversation } from "@/lib/db";

export async function GET() {
  const result = await db.execute(
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
}
