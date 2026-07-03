# DocPilot Demo - AI Knowledge Base Assistant

[中文说明](README.md)

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

## Useful Commands

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
npm run verify
```

## Privacy Notes

- `.env.local`, `data/`, `.next/`, `node_modules/`, `output/`, and test reports are ignored by Git.
- The local database is created at `data/local-db.json` and should not be committed.
- Do not commit real API keys or private user documents.
