# DocPilot Demo - AI Knowledge Base Assistant

DocPilot Demo is a local-first AI knowledge base assistant built with Next.js. It lets users import documents, web links, images, quick notes, and video links into a searchable knowledge base, then ask questions with cited source snippets.

This repository is packaged as a GitHub-friendly demo for AI/RAG product workflows: ingestion, retrieval, cited answers, chat history, library management, annotation, and prompt material generation.

## Features

- Import `.txt`, `.md`, `.markdown`, `.pdf`, `.docx`, `.xlsx`, `.xls`, `.pptx`, `.csv`, `.html`, `.htm`, `.jpg`, `.jpeg`, `.png`, and `.webp` files.
- Save quick notes and web links from the main composer.
- Extract visible text and descriptions from images through the configured AI model.
- Detect Douyin video links and process them into searchable knowledge notes when a downloader and `ffmpeg` are configured.
- Ask questions over imported materials with source citations.
- Manage chat history: resume, rename, and delete conversations.
- Manage the library: search, filter, view source text, delete, export, add processing notes, and annotate source snippets.
- Generate structured prompt materials from selected knowledge items.
- Run locally with a JSON database by default; optionally switch to Supabase/PostgreSQL.

## Tech Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS
- OpenAI SDK with Responses API or Chat Completions support
- Local JSON database at `data/local-db.json`
- Optional Supabase/PostgreSQL + pgvector schema
- `pdf-parse`, `mammoth`, `jszip`, `cheerio`
- Vitest and Playwright

## Project Structure

```text
src/app/                 Next.js pages and API routes
src/components/          Workbench and library UI
src/lib/ai/              OpenAI-compatible calls, embeddings, image/video helpers
src/lib/chat/            Chat orchestration
src/lib/db/              Local JSON and Supabase repositories
src/lib/knowledge/       File parsing, ingestion, classification, export, notes
src/lib/rag/             Retrieval, citation, answer policy, query planning
src/lib/video/           Video download, transcription, frame extraction helpers
docs/demo/               Small sample documents for local demos
supabase/migrations/     Optional Supabase schema
tests/                   Unit, service, and e2e tests
```

## Quick Start

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Fill `OPENAI_API_KEY` in `.env.local` before using AI-backed chat, image understanding, query planning, or video summaries.

```dotenv
DATABASE_PROVIDER=local
LOCAL_DB_PATH=data/local-db.json
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_WIRE_API=responses
OPENAI_DISABLE_RESPONSE_STORAGE=true
OPENAI_CHAT_MODEL=gpt-4o-mini
# Optional for reasoning-capable models: none, minimal, low, medium, high, xhigh
# OPENAI_REASONING_EFFORT=medium
OPENAI_EMBEDDING_MODEL=local-hash-embedding-v1
RAG_MATCH_THRESHOLD=0.78
RAG_MATCH_COUNT=5
RAG_AI_QUERY_PLANNING=true
VIDEO_PROCESSING_ENABLED=true
VIDEO_AUDIO_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
VIDEO_FRAME_INTERVAL_SECONDS=8
VIDEO_MAX_FRAMES=8
VIDEO_FFMPEG_PATH=ffmpeg
DOUYIN_VIDEO_COMMAND_TIMEOUT_MS=180000
```

`OPENAI_BASE_URL` can point to any OpenAI-compatible gateway. The default embedding mode is `local-hash-embedding-v1`, so document indexing does not require cloud embeddings. `OPENAI_REASONING_EFFORT` is optional and should only be enabled for models that support reasoning controls.

## Demo Flow

1. Start the app and open the DocPilot workbench.
2. Upload `docs/demo/售后FAQ.md`.
3. Wait until the material is ready.
4. Ask: `这个产品支持退款吗？`
5. Expand the citations to inspect the source snippet.
6. Open the library page to search, annotate, export, or generate prompt materials.
7. Rename or delete the conversation from the history sidebar.

## Optional Video Processing

Douyin video processing needs a downloader command, audio transcription, and `ffmpeg`. Configure a downloader only if you want to demo video links:

```dotenv
DOUYIN_VIDEO_COMMAND=node
DOUYIN_VIDEO_COMMAND_ARGS=["scripts/download-douyin.js","{url}","{outputDir}"]
```

The placeholders `{url}` and `{outputDir}` are replaced at runtime.

## Optional Supabase Mode

Local JSON storage is the recommended demo mode. To test Supabase instead:

```dotenv
DATABASE_PROVIDER=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Then apply:

```text
supabase/migrations/202606290001_initial_schema.sql
```

## Useful Commands

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
npm run verify
```

`npm run verify` runs lint, unit/service tests, and a production build. Playwright e2e tests are separate because they may need browser setup on a fresh machine.

## Privacy Notes

- `.env.local`, `data/`, `.next/`, `node_modules/`, `output/`, and test reports are ignored by Git.
- The local database is created at `data/local-db.json` and should not be committed.
- Do not commit real API keys or private user documents.
- Demo documents in `docs/demo/` are synthetic samples.

## Known Limits

- Scanned PDFs are not OCRed; only text-extractable PDFs are supported.
- The local hash embedding is an MVP fallback, not a semantic vector model.
- Supabase support is optional and less complete than local demo mode for newer material-management features.
- Video link processing depends on external downloader availability, `ffmpeg`, and transcription configuration.
