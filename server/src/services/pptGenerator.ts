import fs from 'fs';
import path from 'path';
import pptxgen from 'pptxgenjs';
import { GoogleGenAI } from '@google/genai';

const PPTX_OUTPUT_BASE = path.resolve(process.env.PPTX_OUTPUT_PATH ?? './data/pptx');

// ─── Path helpers ─────────────────────────────────────────────────────────────

export function getPptxPath(subjectId: string, moduleNumber: number): string {
  return path.join(PPTX_OUTPUT_BASE, subjectId, `module_${moduleNumber}.pptx`);
}

export function getPptxDir(subjectId: string): string {
  return path.join(PPTX_OUTPUT_BASE, subjectId);
}

export function getPptxStatus(subjectId: string): Record<number, boolean> {
  const dir = getPptxDir(subjectId);
  const status: Record<number, boolean> = {};
  for (let i = 1; i <= 6; i++) {
    status[i] = fs.existsSync(path.join(dir, `module_${i}.pptx`));
  }
  return status;
}

export function getPptxPathIfExists(subjectId: string, moduleNumber: number): string | null {
  const p = getPptxPath(subjectId, moduleNumber);
  return fs.existsSync(p) ? p : null;
}

export function deletePptx(subjectId: string, moduleNumber: number): void {
  const p = getPptxPath(subjectId, moduleNumber);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// ─── LLM: notes → slide JSON ──────────────────────────────────────────────────

async function summarizeNotesToSlides(markdownContent: string): Promise<any[]> {
  const provider = (process.env.PPT_PROVIDER ?? process.env.LLM_PROVIDER ?? 'gemini').toLowerCase();

  const systemInstruction = `You are an expert academic presentation designer.
Convert university lecture notes into a structured JSON array of slides.

STRICT RULES:
1. Each slide must have:
   - "title" (string, max 8 words, concise)
   - "layout" (string: "TEXT_IMAGE" or "DIAGRAM_EXPLANATION")

2. TEXT_IMAGE layout:
   - "points": array of 3-4 SHORT bullet strings (max 10 words each). Be concise.
   - "imagePrompt": a vivid, descriptive prompt for an AI image generator. ALWAYS include this.

3. DIAGRAM_EXPLANATION layout:
   - "mermaidCode": valid Mermaid.js syntax (graph TD, flowchart LR, mindmap, etc.)
     * Keep diagrams SIMPLE: max 8-10 nodes per diagram.
     * If a concept needs many nodes, split it into 2 separate DIAGRAM_EXPLANATION slides.
     * Do NOT use backticks inside the string.
     * Use short node labels (max 4 words each).
   - "detailedExplanation": 1-2 sentences describing the diagram. Keep it brief.

4. Slide count: Generate as many slides as needed to cover the content well (typically 12-20).
   Do NOT artificially limit or pad. Quality over quantity.

5. Visual balance: At least 70% of slides MUST be DIAGRAM_EXPLANATION.
   You MUST generate Mermaid flowcharts to visually explain the concepts. Use flowcharts for architectures, workflows, comparisons, and process steps. Always try to find a reason to use a flowchart.

6. Output ONLY a valid JSON array. No markdown, no explanation, just JSON.
Example:
[
  {"title": "Boolean Algebra Basics", "layout": "TEXT_IMAGE", "points": ["Binary logic system", "Two states: 0 and 1"], "imagePrompt": "Dark digital circuit board with glowing logic gates, blue neon light"},
  {"title": "Boolean Operations Flow", "layout": "DIAGRAM_EXPLANATION", "mermaidCode": "graph TD\\n  A[Input] --> B[AND Gate]\\n  A --> C[OR Gate]\\n  B --> D[Output 1]\\n  C --> E[Output 2]", "detailedExplanation": "Boolean operations process binary inputs through logic gates to produce outputs."}
]`;

  const prompt = `Convert these university lecture notes into presentation slides following all the rules strictly:\n\n${markdownContent}`;

  let raw = '';
  if (provider === 'groq') {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    
    console.log(`[PPT] Requesting Groq stream for PPT generation...`);
    const stream = await client.chat.completions.create({
      model: process.env.PPT_MODEL ?? 'llama3-8b-8192',
      messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: prompt }],
      stream: true,
    });
    
    raw = '';
    for await (const chunk of stream) {
      raw += chunk.choices[0]?.delta?.content || '';
    }
    console.log(`[PPT] Groq stream completed. Received ${raw.length} characters.`);
  } else if (provider === 'openrouter') {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });
    console.log(`[PPT] Requesting OpenRouter stream for PPT generation...`);
    const stream = await client.chat.completions.create({
      model: process.env.OPENROUTER_MODEL ?? 'openrouter/free',
      messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: prompt }],
      stream: true,
    });
    raw = '';
    for await (const chunk of stream) {
      raw += chunk.choices[0]?.delta?.content || '';
    }
    console.log(`[PPT] OpenRouter stream completed. Received ${raw.length} characters.`);
  } else if (provider === 'local') {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: 'ollama',
      baseURL: process.env.LOCAL_API_BASE ?? 'http://localhost:11434/v1',
    });
    const result = await client.chat.completions.create({
      model: process.env.LOCAL_MODEL ?? 'llama3.1',
      messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: prompt }],
    });
    raw = result.choices[0]?.message?.content ?? '';
  } else {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    const ai = new GoogleGenAI({ apiKey });

    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json'
      }
    });

    raw = result.text?.trim() ?? '';
  }
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err: any) {
    throw new Error('Failed to parse LLM response into slide JSON:\n' + raw.slice(0, 400) + '\n' + err.message);
  }
}

// ─── Image fetcher ─────────────────────────────────────────────────────────────

async function fetchImageAsBase64(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.error('Image fetch failed (timeout or network error):', err);
    return null;
  }
}

// ─── Mermaid renderer (high-res, full-width) ──────────────────────────────────

async function renderMermaidToBase64(rawCode: string): Promise<string | null> {
  let code = rawCode.trim();

  // Inject dark theme if missing
  if (!code.startsWith('%%{init:')) {
    code = `%%{init: {'theme': 'dark', 'themeVariables': { 'darkMode': true, 'background': '#0F172A', 'primaryColor': '#3B82F6', 'primaryTextColor': '#F8FAFC', 'lineColor': '#64748B' }}}%%\n${code}`;
  }

  // URL-safe base64
  const base64Code = Buffer.from(code).toString('base64url');

  // High-resolution render: 1600×800 ensures diagram is not clipped
  const mermaidUrl = `https://mermaid.ink/img/${base64Code}?bgColor=0F172A&width=1600&height=800`;

  return fetchImageAsBase64(mermaidUrl, 20000);
}

// ─── PPTX layout constants (inches, LAYOUT_16x9 = 10×5.625) ───────────────────
const SLIDE_W = 10;   // inches
const SLIDE_H = 5.625; // inches
const TITLE_H = 1.05;  // title block height
const CONTENT_Y = TITLE_H + 0.1; // where content starts
const CONTENT_H = SLIDE_H - CONTENT_Y - 0.35; // remaining height minus footer

// ─── Main generator ────────────────────────────────────────────────────────────

export async function generateModulePptx(
  subjectId: string,
  subjectName: string,
  moduleNumber: number,
  moduleTitle: string,
  markdownContent: string
): Promise<string> {
  const outputDir = getPptxDir(subjectId);
  const outputPath = getPptxPath(subjectId, moduleNumber);
  fs.mkdirSync(outputDir, { recursive: true });

  // 1. Get slide data from LLM
  const slides = await summarizeNotesToSlides(markdownContent);

  // 2. Build PPTX
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';

  // ── Master slide definition ─────────────────────────────────────────────────
  pres.defineSlideMaster({
    title: 'PREMIUM_DARK',
    background: { color: '0F172A' },
    slideNumber: { x: '93%', y: '95%', fontSize: 9, color: '475569', fontFace: 'Segoe UI' },
    objects: [
      // Top blue accent bar
      { rect: { x: 0, y: 0, w: '100%', h: 0.06, fill: { color: '3B82F6' } } },
      // Bottom bar
      { rect: { x: 0, y: 5.45, w: '100%', h: 0.18, fill: { color: '1E293B' } } },
      // Footer label
      {
        text: {
          text: subjectName,
          options: { x: 0.3, y: 5.46, w: '55%', h: 0.2, fontSize: 9, color: '475569', fontFace: 'Segoe UI' }
        }
      }
    ]
  });

  // ── Title slide ─────────────────────────────────────────────────────────────
  const titleSlide = pres.addSlide({ masterName: 'PREMIUM_DARK' });
  // Gradient-style background overlay
  titleSlide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: '0F172A' } });
  titleSlide.addText(subjectName, {
    x: 0.8, y: '30%', w: '85%', h: 1.4,
    fontSize: 44, bold: true, align: 'center', color: 'F8FAFC', fontFace: 'Segoe UI',
    autoFit: true
  });
  titleSlide.addText(`Module ${moduleNumber}: ${moduleTitle}`, {
    x: 0.8, y: '52%', w: '85%', h: 0.8,
    fontSize: 24, align: 'center', color: '60A5FA', fontFace: 'Segoe UI',
    autoFit: true
  });

  // ── Helper to add slide title bar ───────────────────────────────────────────
  const addSlideTitle = (presSlide: any, title: string) => {
    // Left accent bar
    presSlide.addShape(pres.ShapeType.rect, { x: 0.3, y: 0.12, w: 0.06, h: 0.78, fill: { color: '3B82F6' } });
    // Title text
    presSlide.addText(title || 'Slide', {
      x: 0.48, y: 0.1, w: SLIDE_W - 0.7, h: TITLE_H - 0.05,
      fontSize: 24, bold: true, color: 'F8FAFC', fontFace: 'Segoe UI',
      valign: 'middle', autoFit: true, shrinkText: true
    });
  };

  // ── Content slides ──────────────────────────────────────────────────────────
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const presSlide = pres.addSlide({ masterName: 'PREMIUM_DARK' });
    const layout = slide.layout || 'TEXT_IMAGE';

    addSlideTitle(presSlide, slide.title);

    // ── TEXT_IMAGE layout ───────────────────────────────────────────────────
    if (layout === 'TEXT_IMAGE') {
      const hasImage = !!slide.imagePrompt;
      const textW = hasImage ? 4.5 : (SLIDE_W - 0.8);
      const textX = 0.48;

      // Bullet points
      if (slide.points && Array.isArray(slide.points) && slide.points.length > 0) {
        const bulletPoints = slide.points.map((p: string) => ({
          text: String(p),
          options: { bullet: { type: 'bullet', indent: 10 }, breakLine: true }
        }));

        presSlide.addText(bulletPoints, {
          x: textX,
          y: CONTENT_Y,
          w: textW,
          h: CONTENT_H,
          fontSize: 19,
          color: 'E2E8F0',
          fontFace: 'Segoe UI',
          valign: 'top',
          lineSpacingMultiple: 1.4,
          autoFit: true,
          shrinkText: true
        });
      }

      // AI illustration — high resolution 1200×900 for clarity
      if (hasImage) {
        const encodedPrompt = encodeURIComponent(
          `${slide.imagePrompt}, dark background, high quality, professional, detailed`
        );
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1200&height=900&nologo=true&enhance=true`;

        try {
          const base64Data = await fetchImageAsBase64(imageUrl, 18000);
          if (base64Data) {
            presSlide.addImage({
              data: base64Data,
              x: 5.1,
              y: CONTENT_Y,
              w: SLIDE_W - 5.3,
              h: CONTENT_H,
              sizing: { type: 'contain', w: SLIDE_W - 5.3, h: CONTENT_H }
            });
          }
        } catch (e: any) {
          console.error('Failed to add image to slide:', e);
        }
      }

    // ── DIAGRAM_EXPLANATION layout ──────────────────────────────────────────
    } else if (layout === 'DIAGRAM_EXPLANATION') {
      // Brief explanation as small subtitle under the title
      if (slide.detailedExplanation) {
        presSlide.addText(slide.detailedExplanation, {
          x: 0.48,
          y: CONTENT_Y,
          w: SLIDE_W - 0.8,
          h: 0.52,
          fontSize: 13,
          color: '94A3B8',
          fontFace: 'Segoe UI',
          italic: true,
          valign: 'top',
          autoFit: true,
          shrinkText: true
        });
      }

      // Diagram fills the ENTIRE remaining slide area below explanation
      if (slide.mermaidCode) {
        try {
          const base64Data = await renderMermaidToBase64(slide.mermaidCode);
          if (base64Data) {
            const diagY = CONTENT_Y + (slide.detailedExplanation ? 0.58 : 0);
            const diagH = SLIDE_H - diagY - 0.3; // stretch to bottom margin

            presSlide.addImage({
              data: base64Data,
              x: 0.2,
              y: diagY,
              w: SLIDE_W - 0.4,
              h: diagH,
              // "contain" scales the image proportionally — no clipping
              sizing: { type: 'contain', w: SLIDE_W - 0.4, h: diagH }
            });
          }
        } catch (e: any) {
          console.error('Failed to add mermaid diagram to slide:', e);
        }
      }
    }
  }

  await pres.writeFile({ fileName: outputPath });
  return outputPath;
}
