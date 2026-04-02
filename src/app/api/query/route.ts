import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db";
import { auth } from "@/auth";

const RAG_API_URL = process.env.RAG_API_URL!;

export async function POST(req: NextRequest) {
  const isPreview = process.env.VERCEL_ENV === "preview";
  const session = await auth();
  const userId = session?.user?.id ?? (isPreview ? "preview" : null);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { question } = await req.json();

  let upstream: Response;
  try {
    upstream = await fetch(`${RAG_API_URL}/query/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.RAG_API_KEY!,
      },
      body: JSON.stringify({ question }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(`RAG API unreachable: ${message}`, { status: 502 });
  }

  if (!upstream.ok) {
    return new Response(`RAG API error: ${upstream.status}`, { status: 502 });
  }

  const encoder = new TextEncoder();
  let answer = "";
  let chunks: { content: string; source: string }[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            let event: { type: string; content: unknown };
            try {
              event = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            if (event.type === "token") {
              answer += event.content;
              controller.enqueue(encoder.encode(line + "\n\n"));
            } else if (event.type === "sources") {
              chunks = event.content as { content: string; source: string }[];
              controller.enqueue(encoder.encode(line + "\n\n"));
            } else if (event.type === "error") {
              controller.enqueue(encoder.encode(line + "\n\n"));
            }
          }
        }

        // 履歴を Turso に保存
        if (answer) {
          try {
            await getDb().execute({
              sql: "INSERT INTO conversations (id, user_id, question, answer, sources) VALUES (?, ?, ?, ?, ?)",
              args: [uuidv4(), userId, question, answer, JSON.stringify(chunks.map((c) => c.source))],
            });
          } catch (e) {
            console.error("Failed to save conversation:", e);
          }
        }
      } catch (e) {
        console.error("Stream error:", e);
      } finally {
        controller.close();
      }
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
