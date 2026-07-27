# TCET AI University Notes Generator - Project Summary

This document serves as a comprehensive technical overview of the "TCET AI University Notes Generator" project. Any AI assistant or developer reading this document should be able to instantly understand the architecture, technology stack, file structure, and specific technical quirks/fixes applied to this codebase.

## 1. High-Level Architecture
This is a monorepo containing a full-stack web application designed to automatically generate structured, lecture-by-lecture university notes based on syllabus and reference materials (PDFs/DOCX).

- **Frontend (`/client`)**: A React Single Page Application (SPA) built with TypeScript and Vite.
- **Backend (`/server`)**: A Node.js/Express API built with TypeScript, handling file processing, AI orchestration, and PDF generation.
- **Database**: SQLite, managed via Prisma ORM (`/server/prisma`).

## 2. Technology Stack
### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **Markdown Rendering**: `marked` (with DOM DOMPurify/Custom plugins if any)
- **State Management**: React Hooks (useState, useEffect, useRef)
- **Key Feature**: Consumes Server-Sent Events (SSE) to display AI-generated notes streaming in real-time.

### Backend
- **Core Engine**: Node.js + Express + TypeScript
- **AI Integration**: `@google/generative-ai` (Gemini API)
- **File Parsing**: 
  - `pdf-parse` (v1.1.1 - downgraded explicitly for CommonJS `require()` compatibility).
  - `mammoth` (for DOCX extraction).
  - `csv-parse` (for structured data).
- **PDF Generation**: `puppeteer` (generates beautifully styled PDFs directly from the markdown output).
- **Database**: Prisma ORM with SQLite.
- **Vector/Embeddings**: Built-in support for vector storage (`vectra`), but **currently bypassed** in favor of direct file-text concatenation to avoid quota limits on embedding models.

## 3. Core Application Flow (Module Notes Generation)

1. **Upload Phase**: Users upload a syllabus PDF and reference materials for a specific subject (e.g., "FIOT").
2. **Planning Phase**: 
   - Frontend calls `POST /api/v1/ai/subjects/:subjectId/modules/:moduleNum/plan`.
   - Backend reads the syllabus file directly.
   - Gemini (`gemini-3.5-flash-lite`) generates a JSON payload outlining the number of lectures, topics, and estimated hours.
3. **Generation Phase (Streaming)**:
   - Frontend calls `POST /api/v1/ai/subjects/:subjectId/modules/:moduleNum/generate` to start generation.
   - Backend reads both syllabus and reference text from disk.
   - Backend loops through the planned lectures and prompts Gemini to generate comprehensive notes.
   - Results are streamed back to the frontend chunk-by-chunk using **Server-Sent Events (SSE)**.
4. **PDF Compilation**:
   - Once all lectures are generated, the backend uses `puppeteer` to render the markdown into a customized HTML template and prints it as a downloadable A4 PDF.
   - The PDF URL is sent as the final SSE event.

## 4. Key Directory Structure

```text
CLG IOT PROTO/
├── client/                     # Frontend Application
│   ├── src/
│   │   ├── api/                # Fetch wrappers (ai.ts)
│   │   ├── components/         # Reusable UI (LoadingSpinner, MarkdownRenderer)
│   │   ├── pages/              # Route views (Dashboard, ModuleNotes.tsx, etc.)
│   │   └── App.tsx             # Main routing
│   ├── vite.config.ts
│   └── package.json
│
├── server/                     # Backend API
│   ├── src/
│   │   ├── controllers/        # Route logic (aiController.ts handles streaming)
│   │   ├── middleware/         # Uploads (multer) and error handling
│   │   ├── routes/             # Express routers
│   │   ├── services/           # Core business logic
│   │   │   ├── llmService.ts       # Gemini API client wrapper & prompting
│   │   │   ├── pdfGenerator.ts     # Puppeteer HTML->PDF logic
│   │   │   ├── pdfIndexer.ts       # PDF parsing logic
│   │   │   ├── datasetIndexer.ts   # General document parsing
│   │   │   ├── subjectRegistry.ts  # Subject metadata
│   │   │   └── vectorStore.ts      # Local vector DB logic (currently bypassed)
│   │   └── index.ts            # Server entry point
│   ├── prisma/                 # Schema & SQLite DB
│   ├── data/                   # Generated PDFs & local vector data
│   ├── uploads/                # User uploaded syllabi/references
│   ├── .env                    # Secrets (GEMINI_API_KEY, GEMINI_MODEL)
│   └── package.json            # Scripts (dev uses cross-env & tsx)
```

## 5. Known Quirks, Fixes, & Important Context

If modifying this project in the future, keep the following hard-fought fixes in mind:

1. **IPv6 Fetch Timeout Issue (Windows / Node 18+)**:
   - **Symptom**: Intermittent `fetch failed` or `Connect Timeout Error` when the Gemini API SDK attempts to communicate with `generativelanguage.googleapis.com`.
   - **Fix Applied**: The `package.json` dev script uses `cross-env NODE_OPTIONS=--dns-result-order=ipv4first` to force Node to prefer IPv4 over IPv6. 

2. **React 18 Stale Closure in SSE**:
   - **Symptom**: When generation completed, all lectures rendered as blank cards on the frontend because `liveChunk` was captured as an empty string in the `lecture_done` closure.
   - **Fix Applied**: In `ModuleNotes.tsx`, a `useRef` (`liveChunkRef`) is used to reliably track the incoming streamed text synchronously without being affected by React closures.

3. **PDF Puppeteer Execution Path**:
   - **Symptom**: `puppeteer` failed to find a browser binary on Windows because recent versions don't bundle Chrome by default.
   - **Fix Applied**: `pdfGenerator.ts` manually checks common Windows system paths (e.g., `C:\Program Files\Google\Chrome\Application\chrome.exe`) and passes the `executablePath` to Puppeteer.

4. **`pdf-parse` ESM/CJS Mismatch**:
   - **Symptom**: `pdfParse is not a function` error on the backend.
   - **Fix Applied**: `pdf-parse` is strictly pinned to version `1.1.1` in `package.json` to ensure CommonJS compatibility with the server's module resolution.

5. **Gemini Model Availability (Quota Limitations)**:
   - **Symptom**: `429 Too Many Requests` or `404 Not Found` when trying to use `gemini-1.5-flash` or `gemini-2.0-flash`.
   - **Fix Applied**: The Google Generative AI SDK is forced to use the `v1` endpoint via `apiVersion: 'v1'` in the client config. The environment uses `gemini-3.5-flash-lite` for generation and `gemini-embedding-001` for embeddings, as these are the models permitted by the current free-tier API key on this specific GCP project.
   - **Fix Applied**: AI Controller bypassed embeddings/vector-retrieval entirely for module generation. It directly reads the raw text of the files into the LLM context to prevent cascading failure of embedding quotas.

---
*Generated by Google Deepmind Antigravity Agent*
