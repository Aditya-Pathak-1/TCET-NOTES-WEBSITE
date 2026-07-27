/**
 * llmService.ts
 * ─────────────
 * LLM abstraction for:
 *   1. Module planning: reads syllabus → returns lecture plan JSON
 *   2. Lecture generation: streams full lecture notes per lecture
 *
 * Priority: syllabus (structure) > reference books (content) > LLM knowledge (fallback)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ContextChunk {
  text: string;
  source: string;
  pageNumbers: number[];
  documentType?: string;
}

export interface LecturePlan {
  lectureNumber: number;
  title: string;
  topics: string[];
  estimatedHours: number;
}

export interface ModulePlan {
  moduleNumber: number;
  moduleTitle: string;
  lectures: LecturePlan[];
  totalHours: number;
}

// ── Gemini Client ─────────────────────────────────────────────────────────────

function getGeminiModel(system: string, model?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel(
    {
      model: model ?? process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite',
      systemInstruction: system,
    },
    { apiVersion: 'v1' } as any
  );
}

// ── Module Planning ───────────────────────────────────────────────────────────

const PLANNER_SYSTEM = `You are an expert university curriculum designer and professor.
Your job is to read a university syllabus and create a detailed lecture plan for one module.
Rules:
1. Each lecture = approximately 1 hour of classroom teaching.
2. Base the number of lectures on topic complexity — typically 6 to 12 per module.
3. Cover every topic in the syllabus — do not skip any.
4. Group related sub-topics into one lecture when appropriate.
5. Return ONLY a valid JSON object — no markdown, no explanation outside JSON.`;

export async function planModule(
  subjectName: string,
  moduleNumber: number,
  syllabusContext: ContextChunk[]
): Promise<ModulePlan> {
  const contextText = syllabusContext
    .map((c, i) => `[Source ${i + 1}: ${c.source}]\n${c.text}`)
    .join('\n\n---\n\n');

  const prompt = `SYLLABUS CONTEXT:
${contextText}

---

TASK: Create a detailed lecture plan for Module ${moduleNumber} of the subject "${subjectName}".

Return ONLY a valid JSON object in this EXACT format (no markdown fences, no extra text):
{
  "moduleNumber": ${moduleNumber},
  "moduleTitle": "...",
  "lectures": [
    {
      "lectureNumber": 1,
      "title": "...",
      "topics": ["topic 1", "topic 2"],
      "estimatedHours": 1
    }
  ],
  "totalHours": 0
}

Set totalHours = sum of all estimatedHours.
Cover ALL topics in the syllabus. Do not skip any.
CRITICAL: If the syllabus explicitly states the number of hours or lectures for this module (e.g., "8 hrs" or "8 lectures"), you MUST generate exactly that number of lectures (e.g., exactly 8 lectures, each 1 hour long). Do not group topics together to reduce the count.`;

  const geminiModel = getGeminiModel(PLANNER_SYSTEM, 'gemini-3.5-flash-lite');
  const result = await geminiModel.generateContent(prompt);
  const raw = result.response.text().trim();

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    const plan = JSON.parse(cleaned) as ModulePlan;
    plan.totalHours = plan.lectures.reduce((sum, l) => sum + (l.estimatedHours || 1), 0);
    return plan;
  } catch {
    throw new Error(`Module planning failed — LLM returned invalid JSON:\n${raw.slice(0, 300)}`);
  }
}

// ── Lecture Generation ────────────────────────────────────────────────────────

function buildLectureSystemPrompt(): string {
  return `You are an experienced university professor writing an official module handbook for engineering students.

ABSOLUTE RULES:
1. PRIORITY 1 — Use the uploaded SYLLABUS to define structure and scope.
2. PRIORITY 2 — Use uploaded REFERENCE BOOK chunks as the primary source for theory, definitions, examples, algorithms, and formulas.
3. PRIORITY 3 — Only if reference books don't cover a topic, use your own knowledge. When you do this, maintain the same academic writing style.
4. NEVER say "I don't know" or leave sections empty. Always generate complete content.
5. Write at university level. Notes should be detailed enough for exam preparation.
6. Every lecture must represent ~1 hour of classroom teaching — be thorough, not brief.
7. IMPORTANT: Do NOT use mermaid diagrams or any diagram code blocks. Instead, represent diagrams using plain ASCII art or well-structured text/tables.
8. Use LaTeX-style math notation where formulas are required (wrap in $...$).
9. Use proper tables with headers for comparisons.
10. Figure captions format: Fig.{moduleNumber}.{lectureNumber}.{n} — {Caption}

RETURN THE LECTURE IN THIS EXACT STRUCTURE (do not deviate):

---

## Lecture {N} — {Title}

**Module:** {moduleNumber} | **Subject:** {subjectName} | **Est. Duration:** {hours} hour(s)

---

### 1. Introduction
[2-4 sentences setting context and motivation for this lecture]

---

### 2. Theory & Background
[Detailed theoretical explanation — minimum 3-4 paragraphs]

---

### 3. Key Definitions
| Term | Definition |
|------|-----------|
| ... | ... |

---

### 4. Detailed Explanation
[In-depth explanation of each topic in this lecture — use sub-sections if needed]

---

### 5. Diagrams & Process Flows
[Represent the key process or architecture using ASCII art or a structured text description. Example:

\`\`\`text
[Sensor] --> [Gateway] --> [Cloud Server] --> [User App]
                |                |
           [Local DB]      [Analytics]
\`\`\`
Fig.{M}.{L}.1 — [Caption]]

---

### 6. Worked Examples
[2-3 concrete examples with step-by-step solutions]

---

### 7. Real-World Applications
[3-5 bullet points with practical applications used in industry]

---

### 8. Common Mistakes & Pitfalls
[3-5 bullet points students commonly get wrong]

---

### 9. Important Points to Remember
[5-7 concise bullet points — exam-relevant]

---

### 10. Short Revision Summary
[5-7 sentence summary of this lecture]

---

### 11. MCQs (Multiple Choice Questions)
**Q1.** [Question]
- A) ...
- B) ...
- C) ...
- D) ...
**Answer:** [Letter] — [Brief explanation]

[Repeat for 4-6 MCQs total]

---

### 12. Short Answer Questions
1. [Question] *(2-3 marks)*
2. [Question] *(2-3 marks)*
3. [Question] *(5 marks)*
[3-5 questions total]

---

### 13. Exercises
[1-3 practice problems or tasks — include expected output/answer]

---`;
}

function buildLectureUserPrompt(
  subjectName: string,
  moduleNumber: number,
  moduleTitle: string,
  lecture: LecturePlan,
  syllabusContext: ContextChunk[],
  referenceContext: ContextChunk[]
): string {
  const syllabusText = syllabusContext.length
    ? syllabusContext.map((c, i) => `[SYLLABUS Source ${i + 1}: ${c.source}]\n${c.text}`).join('\n\n---\n\n')
    : 'No syllabus context available — use general knowledge for this subject.';

  const referenceText = referenceContext.length
    ? referenceContext.map((c, i) => `[REFERENCE Source ${i + 1}: ${c.source}]\n${c.text}`).join('\n\n---\n\n')
    : 'No reference book uploaded — use your academic knowledge.';

  return `=== SYLLABUS CONTEXT (STRUCTURE & SCOPE) ===
${syllabusText}

=== REFERENCE BOOK CONTEXT (PRIMARY CONTENT SOURCE) ===
${referenceText}

===

TASK: Generate complete lecture notes for the following lecture.

Subject: "${subjectName}"
Module ${moduleNumber}: ${moduleTitle}
Lecture ${lecture.lectureNumber}: ${lecture.title}
Topics to cover: ${lecture.topics.join(', ')}
Estimated duration: ${lecture.estimatedHours} hour(s)

Write the full lecture notes following the exact 13-section structure defined in your instructions.
Be thorough. This is official university study material.`;
}

// ── Streaming Lecture Generation ──────────────────────────────────────────────

export async function* generateLecture(
  subjectName: string,
  moduleNumber: number,
  moduleTitle: string,
  lecture: LecturePlan,
  syllabusContext: ContextChunk[],
  referenceContext: ContextChunk[]
): AsyncGenerator<string> {
  const provider = (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase();
  const systemPrompt = buildLectureSystemPrompt();
  const userPrompt = buildLectureUserPrompt(
    subjectName, moduleNumber, moduleTitle, lecture, syllabusContext, referenceContext
  );

  if (provider === 'openai') {
    yield* generateWithOpenAI(systemPrompt, userPrompt);
  } else if (provider === 'claude' || provider === 'anthropic') {
    yield* generateWithClaude(systemPrompt, userPrompt);
  } else {
    yield* generateWithGemini(systemPrompt, userPrompt);
  }
}

// Keep old generateNotes for backward compat
export async function* generateNotes(
  topic: string,
  subjectName: string,
  moduleName: string,
  context: ContextChunk[]
): AsyncGenerator<string> {
  const fakeLecture: LecturePlan = {
    lectureNumber: 1,
    title: topic,
    topics: [topic],
    estimatedHours: 1,
  };
  yield* generateLecture(subjectName, 0, moduleName, fakeLecture, [], context);
}

// ── Provider Implementations ──────────────────────────────────────────────────

async function* generateWithGemini(system: string, user: string, retries = 3): AsyncGenerator<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const model = getGeminiModel(system, process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite');
      const result = await model.generateContentStream(user);
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
      return; // success — exit retry loop
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isFetchError = msg.includes('fetch failed') || msg.includes('ECONNRESET') || msg.includes('timeout');
      if (isFetchError && attempt < retries) {
        console.warn(`[llmService] Gemini fetch failed (attempt ${attempt}/${retries}), retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000 * attempt)); // exponential backoff
        continue;
      }
      throw err; // non-retriable error or out of retries
    }
  }
}

async function* generateWithOpenAI(system: string, user: string): AsyncGenerator<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const stream = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? 'gpt-4o',
    stream: true,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  });
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

async function* generateWithClaude(system: string, user: string): AsyncGenerator<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const stream = await client.messages.create({
    model: process.env.CLAUDE_MODEL ?? 'claude-3-5-sonnet-20241022',
    max_tokens: 16000,
    stream: true,
    system,
    messages: [{ role: 'user', content: user }],
  });
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}
