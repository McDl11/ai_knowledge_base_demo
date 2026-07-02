# DocPilot Demo - AI 知识库助手

DocPilot Demo 是一个本地优先的 AI 知识库助手，用 Next.js 构建。它可以把文档、网页链接、图片、随手记录和视频链接整理进可检索的资料库，再基于这些资料进行带引用来源的问答。

这个仓库已经整理成适合放到 GitHub 的 demo：重点展示资料入库、检索问答、引用溯源、历史对话、资料库管理、资料标注和提示词素材生成。

## 功能亮点

- 支持导入 `.txt`、`.md`、`.markdown`、`.pdf`、`.docx`、`.xlsx`、`.xls`、`.pptx`、`.csv`、`.html`、`.htm`、`.jpg`、`.jpeg`、`.png`、`.webp`。
- 支持在主输入框里保存想法、笔记和网页链接。
- 支持通过配置的 AI 模型理解图片内容，提取可见文字并生成说明。
- 支持识别抖音视频链接；配置下载器和 `ffmpeg` 后，可以把视频处理成可检索的知识笔记。
- 支持基于已入库资料提问，并展示引用来源和原文片段。
- 支持历史对话查看、恢复、重命名和删除。
- 支持资料库搜索、筛选、查看原文、删除、导出、添加处理说明和片段注释。
- 支持选中资料后生成结构化提示词素材。
- 默认使用本地 JSON 数据库，也可以切换到 Supabase/PostgreSQL。

## 技术栈

- Next.js 16、React 19、TypeScript
- Tailwind CSS
- OpenAI SDK，支持 Responses API 或 Chat Completions
- 本地 JSON 数据库：`data/local-db.json`
- 可选 Supabase/PostgreSQL + pgvector
- `pdf-parse`、`mammoth`、`jszip`、`cheerio`
- Vitest、Playwright

## 目录结构

```text
src/app/                 Next.js 页面和 API 路由
src/components/          工作台和资料库 UI
src/lib/ai/              OpenAI-compatible 调用、embedding、图片/视频辅助能力
src/lib/chat/            问答流程编排
src/lib/db/              本地 JSON 和 Supabase 仓库
src/lib/knowledge/       文件解析、入库、分类、导出、注释
src/lib/rag/             检索、引用、回答策略、查询规划
src/lib/video/           视频下载、转写、抽帧和诊断
docs/demo/               本地演示用的示例资料
supabase/migrations/     可选 Supabase 数据库结构
tests/                   单元、服务和端到端测试
```

## 快速启动

需要 Node.js 20.9 或更高版本。

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。

使用 AI 问答、图片理解、查询规划或视频总结前，需要在 `.env.local` 里填写 `OPENAI_API_KEY`。

```dotenv
DATABASE_PROVIDER=local
LOCAL_DB_PATH=data/local-db.json
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_WIRE_API=responses
OPENAI_DISABLE_RESPONSE_STORAGE=true
OPENAI_CHAT_MODEL=gpt-4o-mini
# 可选，仅推理模型需要：none, minimal, low, medium, high, xhigh
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

`OPENAI_BASE_URL` 可以换成任何 OpenAI-compatible 网关。默认的 `local-hash-embedding-v1` 是本地兜底 embedding，文档入库时不会额外调用云端 embedding。

## 演示流程

1. 启动应用并打开 DocPilot 工作台。
2. 上传 `docs/demo/售后FAQ.md`。
3. 等待资料状态变为可用。
4. 提问：`这个产品支持退款吗？`
5. 展开回答里的引用来源，查看原文片段。
6. 打开资料库页面，尝试搜索、标注、导出或生成提示词素材。
7. 在左侧历史栏重命名或删除对话。

## 可选：视频处理

抖音视频处理依赖下载命令、音频转写和 `ffmpeg`。需要演示视频链接时，可以配置：

```dotenv
DOUYIN_VIDEO_COMMAND=node
DOUYIN_VIDEO_COMMAND_ARGS=["scripts/download-douyin.js","{url}","{outputDir}"]
```

运行时会把 `{url}` 和 `{outputDir}` 替换成视频链接和临时输出目录。

## 可选：Supabase 模式

本地 JSON 是推荐的 demo 模式。如果要测试 Supabase：

```dotenv
DATABASE_PROVIDER=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

然后应用迁移文件：

```text
supabase/migrations/202606290001_initial_schema.sql
```

## 常用命令

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
npm run verify
```

`npm run verify` 会依次运行 lint、单元/服务测试和生产构建。Playwright 端到端测试单独运行，因为新机器上可能需要先安装浏览器。

## 隐私和提交说明

- `.env.local`、`data/`、`.next/`、`node_modules/`、`output/` 和测试报告都已加入 `.gitignore`。
- 本地数据库默认生成在 `data/local-db.json`，不要提交。
- 不要提交真实 API Key 或私人资料。
- `docs/demo/` 里的文件是合成示例资料，适合公开 demo。

## 已知限制

- 扫描版 PDF 暂不支持 OCR，只支持能提取文本的 PDF。
- 本地 hash embedding 是 MVP 兜底方案，不是真正的语义向量模型。
- Supabase 支持是可选能力，新资料管理功能优先以本地模式验证。
- 视频链接处理依赖外部下载器、`ffmpeg` 和转写配置。
