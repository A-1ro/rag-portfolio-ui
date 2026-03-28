import { createClient, type Client } from "@libsql/client/http";

let _db: Client | null = null;

export function getDb(): Client {
  if (!_db) {
    // Vercel serverless では WebSocket が使えないため libsql:// → https:// に変換
    const url = process.env.TURSO_DB_URL!.replace(/^libsql:\/\//, "https://");
    _db = createClient({
      url,
      authToken: process.env.TURSO_DB_AUTH_TOKEN!,
    });
  }
  return _db;
}

export type Conversation = {
  id: string;
  question: string;
  answer: string;
  sources: string[];
  created_at: string;
};
