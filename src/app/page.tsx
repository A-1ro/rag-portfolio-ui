"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import type { Conversation } from "@/lib/db";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Conversation[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    const data = await res.json();
    setHistory(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "token") {
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

  function loadHistory(item: Conversation) {
    setMessages([
      { role: "user", content: item.question },
      { role: "assistant", content: item.answer, sources: item.sources },
    ]);
  }

  return (
    <div className="flex h-screen">
      {/* サイドバー */}
      <aside
        className={`${sidebarOpen ? "w-64" : "w-0"} overflow-hidden transition-all duration-300 bg-white border-r border-gray-200 flex flex-col`}
      >
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">履歴</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">まだ履歴がありません</p>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => loadHistory(item)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-100 truncate"
              >
                {item.question}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ヘッダー */}
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="font-semibold text-gray-900">RAG Portfolio</h1>
          <span className="text-xs text-gray-400 ml-auto">LangChain · Qdrant · Groq</span>
          {session?.user && (
            <div className="flex items-center gap-2 ml-4">
              {session.user.image && (
                <img src={session.user.image} alt="avatar" className="w-6 h-6 rounded-full" />
              )}
              <span className="text-xs text-gray-600">{session.user.name}</span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                ログアウト
              </button>
            </div>
          )}
        </header>

        {/* メッセージ */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              質問を入力してください
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-2xl ${msg.role === "user" ? "order-1" : ""}`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-gray-900 text-white"
                      : "bg-white border border-gray-200 text-gray-900"
                  }`}
                >
                  {msg.content}
                  {msg.role === "assistant" && loading && i === messages.length - 1 && !msg.content && (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.sources.map((name) => (
                      <span
                        key={name}
                        className="text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-2.5 py-0.5"
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
        <div className="px-4 py-4 bg-white border-t border-gray-200">
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="質問を入力..."
              disabled={loading}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-900 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              送信
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
