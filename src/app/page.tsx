"use client";

import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { useSession, signOut } from "next-auth/react";
import type { Session } from "@/lib/db";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Session[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchHistory() {
    const res = await fetch("/api/history");
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) setHistory(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const currentSessionId = sessionId ?? uuidv4();
    if (!sessionId) setSessionId(currentSessionId);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sessionId: currentSessionId }),
      });

      if (!res.ok) {
        const text = await res.text();
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: `エラーが発生しました (${res.status}): ${text}`,
          };
          return updated;
        });
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? ""; // 最後の不完全な行を次チャンクに持ち越す

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: { type: string; content: unknown };
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (event.type === "token") {
            if (typeof event.content !== "string") continue;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: updated[updated.length - 1].content + event.content,
              };
              return updated;
            });
          } else if (event.type === "sources") {
            const sources: string[] = [
              ...new Set(
                (event.content as { content: string; source: string }[]).map((c) =>
                  c.source.split("/").pop() ?? c.source
                )
              ),
            ];
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                sources,
              };
              return updated;
            });
          }
        }
      }
    } finally {
      setLoading(false);
      fetchHistory();
    }
  }

  function startNewChat() {
    setMessages([]);
    setSessionId(null);
  }

  function loadHistory(item: Session) {
    const msgs: Message[] = item.messages.flatMap((conv) => [
      { role: "user" as const, content: conv.question },
      { role: "assistant" as const, content: conv.answer, sources: conv.sources },
    ]);
    setMessages(msgs);
    setSessionId(item.session_id);
  }

  return (
    <div className="flex h-dvh bg-gray-50 dark:bg-gray-950">
      {/* モバイル：サイドバー背景暗幕 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 md:relative md:inset-auto md:z-auto ${
          sidebarOpen
            ? "translate-x-0 md:w-64"
            : "-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden"
        }`}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">履歴</h2>
          <button
            type="button"
            onClick={startNewChat}
            className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            ＋ 新規
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <p className="p-4 text-sm text-gray-400 dark:text-gray-500">まだ履歴がありません</p>
          ) : (
            history.map((item) => (
              <button
                key={item.session_id}
                type="button"
                onClick={() => loadHistory(item)}
                className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 dark:border-gray-700 truncate transition-colors ${
                  item.session_id === sessionId
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <span className="truncate block">{item.title}</span>
                {item.messages.length > 1 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{item.messages.length} メッセージ</span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ヘッダー */}
        <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="font-semibold text-gray-900 dark:text-white">RAG Portfolio</h1>
          <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 ml-auto">LangChain · Qdrant · Groq</span>
          {session?.user && (
            <div className="flex items-center gap-2 ml-auto sm:ml-4">
              {session.user.image && (
                <img src={session.user.image} alt={session.user.name || "avatar"} className="w-6 h-6 rounded-full" />
              )}
              <span className="hidden sm:inline text-xs text-gray-600 dark:text-gray-400">{session.user.name}</span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-xs text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                ログアウト
              </button>
            </div>
          )}
        </header>

        {/* メッセージ */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600 text-sm">
              質問を入力してください
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-full sm:max-w-2xl ${msg.role === "user" ? "order-1" : ""}`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-gray-900 dark:bg-gray-700 text-white"
                      : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  }`}
                >
                  {msg.content}
                  {msg.role === "assistant" && loading && i === messages.length - 1 && !msg.content && (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.sources.map((name) => (
                      <span
                        key={name}
                        className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 rounded-full px-2.5 py-0.5"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 入力フォーム */}
        <div className="px-4 py-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="質問を入力..."
              disabled={loading}
              className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-4 py-2.5 text-sm outline-none focus:border-gray-900 dark:focus:border-gray-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-xl hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              送信
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
