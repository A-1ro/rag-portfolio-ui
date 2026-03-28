import { createClient } from "@libsql/client";

export const db = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_DB_AUTH_TOKEN!,
});

export type Conversation = {
  id: string;
  question: string;
  answer: string;
  sources: string[];
  created_at: string;
};
