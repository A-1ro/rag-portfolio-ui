# rag-portfolio-ui

RAG（Retrieval-Augmented Generation）バックエンドと連携するチャット UI。GitHub 認証、ストリーミング応答、会話履歴の永続化に対応。

## 機能

- **RAG ストリーミングチャット** — バックエンド API に SSE でリクエストし、トークンをリアルタイム表示
- **会話履歴** — Turso（SQLite）に保存し、サイドバーから過去の Q&A を再表示
- **GitHub OAuth 認証** — NextAuth v5 によるサインイン
- **レスポンシブ対応** — モバイルはサイドバードロワー、PC は固定パネル
- **ダークモード** — `prefers-color-scheme: dark` に自動対応

## 技術スタック

| 層 | 技術 |
|----|------|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | TypeScript 5 |
| スタイリング | Tailwind CSS 4 |
| 認証 | NextAuth v5 (GitHub OAuth) |
| DB | Turso (libSQL / SQLite) |
| フォント | Geist |

## セットアップ

### 1. 依存インストール

```bash
npm install
```

### 2. 環境変数

`.env.local` を作成し、以下を設定する。

```env
# GitHub OAuth
# https://github.com/settings/developers から取得
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# NextAuth シークレット（openssl rand -base64 32 で生成）
AUTH_SECRET=

# RAG バックエンド API
RAG_API_URL=https://your-rag-api.example.com
RAG_API_KEY=

# Turso
# https://turso.tech のダッシュボードから取得
TURSO_DB_URL=libsql://your-db.turso.io
TURSO_DB_AUTH_TOKEN=
```

### 3. DB テーブル作成

Turso CLI またはダッシュボードで以下を実行。

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources TEXT NOT NULL DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4. 開発サーバー起動

```bash
npm run dev
```

`http://localhost:3000` にアクセス。

## GitHub OAuth アプリの設定

1. [GitHub Developer Settings](https://github.com/settings/developers) → **New OAuth App**
2. 以下を設定:
   - **Homepage URL**: `http://localhost:3000`（本番は本番 URL）
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
3. 生成された `Client ID` / `Client Secret` を `.env.local` に設定

## RAG バックエンド API 仕様

`/api/query` は以下の形式でバックエンドへリクエストを転送する。

**リクエスト**
```
POST {RAG_API_URL}/query/stream
X-API-Key: {RAG_API_KEY}

{ "question": "..." }
```

**SSE レスポンス形式**
```
data: {"type": "token", "content": "..."}
data: {"type": "sources", "content": [{"content": "...", "source": "path/to/doc.md"}]}
data: {"type": "error", "content": "..."}
```

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx              # チャット UI（メインページ）
│   ├── layout.tsx            # ルートレイアウト
│   ├── login/page.tsx        # ログインページ
│   └── api/
│       ├── query/route.ts    # RAG API プロキシ（SSE）
│       └── history/route.ts  # 会話履歴取得
├── components/
│   └── SessionProvider.tsx   # NextAuth セッションプロバイダー
├── lib/
│   └── db.ts                 # Turso DB クライアント
├── auth.ts                   # NextAuth 設定
└── middleware.ts             # 認証ミドルウェア
```

## デプロイ（Vercel）

```bash
vercel deploy
```

環境変数は Vercel ダッシュボードまたは `vercel env add` で設定すること。
本番の GitHub OAuth コールバック URL を `https://your-domain.vercel.app/api/auth/callback/github` に更新すること。
