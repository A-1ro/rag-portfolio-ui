import { createClient, type Client } from "@libsql/client";

let _db: Client | null = null;

export function getDb(): Client {
  if (!_db) {
    _db = createClient({
      url: process.env.TURSO_DB_URL!,
      authToken: process.env.TURSO_DB_AUTH_TOKEN!,
    });
  }
  return _db;
}

export type Conversation = {
  id: string;
  session_id: string;
  user_id: string;
  question: string;
  answer: string;
  sources: string[];
  created_at: string;
};

export type Session = {
  session_id: string;
  title: string;
  messages: Conversation[];
  created_at: string;
};
