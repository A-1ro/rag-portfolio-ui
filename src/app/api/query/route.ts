import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db";
import { auth } from "@/auth";

const RAG_API_URL = process.env.RAG_API_URL!;

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { question, sessionId } = await req.json();
  if (!question || typeof question !== "string") {
    return new Response("Bad Request", { status: 400 });
  }
  const resolvedSessionId: string = typeof sessionId === "string" && sessionId ? sessionId : uuidv4();

  const upstream = await fetch(`${RAG_API_URL}/query/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.RAG_API_KEY!,
    },
    body: JSON.stringify({ question }),
  });

  if (!upstream.ok) {
    return new Response("RAG API error", { status: 502 });
  }

  const encoder = new TextEncoder();
  let answer = "";
  let chunks: { content: string; source: string }[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "token") {
            answer += event.content;
            controller.enqueue(encoder.encode(line + "\n\n"));
          } else if (event.type === "sources") {
            chunks = event.content;
            controller.enqueue(encoder.encode(line + "\n\n"));
          } else if (event.type === "error") {
            controller.enqueue(encoder.encode(line + "\n\n"));
          }
        }
      }

      // 履歴を Turso に保存
      if (answer) {
        await getDb().execute({
          sql: "INSERT INTO conversations (id, session_id, user_id, question, answer, sources) VALUES (?, ?, ?, ?, ?, ?)",
          args: [uuidv4(), resolvedSessionId, userId, question, answer, JSON.stringify(chunks.map((c) => c.source))],
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
