/**
 * llmService.ts
 * ─────────────
 * LLM abstraction for:
 *   1. Module planning: reads syllabus → returns lecture plan JSON
 *   2. Lecture generation: streams full lecture notes per lecture
 *
 * Priority: syllabus (structure) > reference books (content) > LLM knowledge (fallback)
 */

import { GoogleGenAI } from '@google/genai';

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

// ── Gemini REST API helpers ───────────────────────────────────────────────────

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  return new GoogleGenAI({ apiKey });
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

async function generateContent(system: string, user: string): Promise<string> {
  const provider = (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase();

  if (provider === 'groq') {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    const result = await client.chat.completions.create({
      model: process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    });
    return result.choices[0]?.message?.content ?? '';
  }

  if (provider === 'openrouter') {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });
    const result = await client.chat.completions.create({
      model: process.env.OPENROUTER_MODEL ?? 'google/gemma-2-9b-it:free',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    });
    return result.choices[0]?.message?.content ?? '';
  }

  if (provider === 'local') {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: 'ollama',
      baseURL: process.env.LOCAL_API_BASE ?? 'http://localhost:11434/v1',
    });
    const result = await client.chat.completions.create({
      model: process.env.LOCAL_MODEL ?? 'llama3.1',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    });
    return result.choices[0]?.message?.content ?? '';
  }

  const ai = getGeminiClient();
  const result = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
    contents: user,
    config: { systemInstruction: system }
  });
  return result.text?.trim() ?? '';
}

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

  const raw = (await generateContent(PLANNER_SYSTEM, prompt)).trim();

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

function buildLectureSystemPrompt(subjectName: string): string {
  const isMath = subjectName.toLowerCase().includes('math');

  const baseRules = `You are an experienced university professor writing an official module handbook for engineering students.

ABSOLUTE RULES:
1. PRIORITY 1 — Use the uploaded SYLLABUS to define structure and scope.
2. PRIORITY 2 — Use uploaded REFERENCE BOOK chunks as the primary source for theory, definitions, examples, algorithms, and formulas.
3. If a requested topic is completely irrelevant, not applicable to the syllabus, or outside the scope of the subject, do NOT generate hallucinated content and do NOT output any text or heading for it. Just completely skip it.
4. If a topic is applicable but not fully covered in the reference book, you may use your academic knowledge to fill gaps.
5. Write at university level. Notes should be detailed enough for exam preparation.
6. Provide an extremely detailed, comprehensive theoretical explanation for each topic. Expand deeply on all theories, operations, and background concepts to ensure the content is very rich and thorough (aim for 1500-2000 words total). The theory section must be extensive. IMPORTANT: Do NOT artificially repeat headings, lecture numbers, or content to increase length; instead, provide more depth, real-world examples, and technical details.
7. If a process, algorithm, or architecture can be visualized, generate a flowchart or diagram using a Mermaid.js code block (e.g., ```mermaid ... ```). Do NOT use ASCII art diagrams.
8. Do NOT use LaTeX-style math notation (like $0$). Write out all math, numbers, and formulas in plain English text.
9. Use proper tables with headers for comparisons.`;

  const structure = isMath ? `
RETURN THE LECTURE IN THIS EXACT STRUCTURE (do not deviate):

---

## lecture no := {N}

**Module:** {moduleNumber} | **Subject:** {subjectName} | **Est. Duration:** {hours} hour(s)

### Introduction
[Brief introduction to the lecture]

---

*(Repeat the following structure for EVERY topic covered in this lecture. Ensure the topic name itself is in bold at the start of the section)*

**Topic name : {Name of Topic}**

### Key Definitions
[Definitions relevant to the topic]

### Concept Explanation
[Detailed concept explanation]

*(If the topic involves a Truth Table or Characteristic Table, add a section starting with "### Truth Table / Characteristic Table" and provide the table here. Otherwise, omit this section completely.)*

### Example / Solved Problem
[Examples and solved problems]

### Applications
[Applications]

*(If the topic involves Formulas, add a section starting with "### Formula" and provide them here. Otherwise, omit this section completely.)*

*(End of per-topic structure)*

---

### Common Exam Questions
1. [Question 1]
2. [Question 2]

---

### MCQs (with answers)
**Q1.** [Question]
- A) ...
- B) ...
- C) ...
- D) ...
**Answer:** [Letter] — [Brief explanation]

---

### Key Takeaways
- [Takeaway 1]
- [Takeaway 2]

---

### Practice Problems
1. [Problem 1]
2. [Problem 2]

---` : `
RETURN THE LECTURE IN THIS EXACT STRUCTURE (do not deviate):

---

## Lecture no:- {N}

**Module:** {moduleNumber} | **Subject:** {subjectName} | **Est. Duration:** {hours} hour(s)

---

*(Repeat the following structure for EVERY topic covered in this lecture. Ensure the topic name itself is in bold at the start of the section)*

**Topic name : {Name of Topic}**

### Definition
[Clear definition of the topic]

### Theory/Introduction
[Detailed theoretical explanation and background]

### Working / Operation
[Detailed step-by-step working or operation]

*(If the topic involves a Truth Table or Excitation Table, add a section starting with "### Truth Table / Excitation Table" and provide the table here. Otherwise, omit this section completely.)*

### Advantages
- [Advantage 1]
- [Advantage 2]

### Disadvantages
- [Disadvantage 1]
- [Disadvantage 2]

### Applications
- [Application 1]
- [Application 2]

*(End of per-topic structure)*

---

### MCQs (Let's check the take away)
**Q1.** [Question]
- A) ...
- B) ...
- C) ...
- D) ...
**Answer:** [Letter] — [Brief explanation]

*(Repeat for 4-6 MCQs total)*

---

### Exercise Questions
1. [Question] *(2-3 marks)*
2. [Question] *(5 marks)*

*(3-5 questions total)*

---

### Learning Outcome
- [Learning outcome 1]
- [Learning outcome 2]

---`;

  return `${baseRules}\n${structure}`;
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

  // To prevent hitting strict free-tier TPM limits on Groq, limit to top 5 reference chunks
  const limitedReferenceContext = referenceContext.slice(0, 5);

  const referenceText = limitedReferenceContext.length
    ? limitedReferenceContext.map((c, i) => `[REFERENCE Source ${i + 1}: ${c.source}]\n${c.text}`).join('\n\n---\n\n')
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
  const systemPrompt = buildLectureSystemPrompt(subjectName);
  const userPrompt = buildLectureUserPrompt(
    subjectName, moduleNumber, moduleTitle, lecture, syllabusContext, referenceContext
  );

  if (provider === 'groq') {
    yield* generateWithGroq(systemPrompt, userPrompt);
  } else if (provider === 'openrouter') {
    yield* generateWithOpenRouter(systemPrompt, userPrompt);
  } else if (provider === 'local') {
    yield* generateWithLocal(systemPrompt, userPrompt);
  } else if (provider === 'openai') {
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
      const ai = getGeminiClient();
      const resultStream = await ai.models.generateContentStream({
        model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
        contents: user,
        config: { systemInstruction: system }
      });
      for await (const chunk of resultStream) {
        const text = chunk.text;
        if (text) yield text;
      }
      return; // success — exit retry loop
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isFetchError = msg.includes('fetch failed') || msg.includes('ECONNRESET') || msg.includes('timeout');
      if (isFetchError && attempt < retries) {
        console.warn(`[llmService] Gemini fetch failed (attempt ${attempt}/${retries}), retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw err;
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

async function* generateWithGroq(system: string, user: string): AsyncGenerator<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
  
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const stream = await client.chat.completions.create({
        model: process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant',
        stream: true,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) yield text;
      }
      return; // Success, exit retry loop
    } catch (err: any) {
      if (err?.status === 429 && attempt < maxRetries) {
        console.warn(`[Groq] Rate limit hit (attempt ${attempt}/${maxRetries}). Retrying in 5s...`);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      throw err;
    }
  }
}

async function* generateWithLocal(system: string, user: string): AsyncGenerator<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey: 'ollama',
    baseURL: process.env.LOCAL_API_BASE ?? 'http://localhost:11434/v1',
  });
  const stream = await client.chat.completions.create({
    model: process.env.LOCAL_MODEL ?? 'llama3.1',
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

async function* generateWithOpenRouter(system: string, user: string): AsyncGenerator<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  });
  
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const stream = await client.chat.completions.create({
        model: process.env.OPENROUTER_MODEL ?? 'google/gemma-2-9b-it:free',
        stream: true,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) yield text;
      }
      return; // Success, exit retry loop
    } catch (err: any) {
      if (err?.status === 429 && attempt < maxRetries) {
        console.warn(`[OpenRouter] Rate limit hit (attempt ${attempt}/${maxRetries}). Retrying in 5s...`);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      throw err;
    }
  }
}
