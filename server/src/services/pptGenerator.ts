import fs from 'fs';
import path from 'path';
import pptxgen from 'pptxgenjs';
import { GoogleGenerativeAI } from '@google/generative-ai';

const PPTX_OUTPUT_BASE = path.resolve(process.env.PPTX_OUTPUT_PATH ?? './data/pptx');

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

async function summarizeNotesToSlides(markdownContent: string): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const systemInstruction = `You are an expert presentation designer.
Your task is to take detailed university lecture notes and convert them into a structured JSON array of presentation slides.
RULES:
1. Each slide must have a "title" (string) and a "layout" (string, either "TEXT_IMAGE" or "DIAGRAM_EXPLANATION").
2. For "TEXT_IMAGE" layout, provide an array of short strings "points" (max 5 points) and an "imagePrompt" (string) for an AI illustration.
3. For "DIAGRAM_EXPLANATION" layout, provide "mermaidCode" (string, valid Mermaid.js syntax for a diagram, flowchart, or mindmap) instead of an image prompt, and a "detailedExplanation" (string, 1-3 sentences) instead of points. Make sure the Mermaid syntax does not contain markdown code block backticks inside the string, just raw syntax.
4. Use a mix of both layouts to make the presentation highly engaging. Use diagrams/mindmaps to explain architectures, classifications, or workflows where appropriate.
5. Output ONLY a valid JSON array of objects. Example: 
[
  {"title": "Introduction", "layout": "TEXT_IMAGE", "points": ["Point 1"], "imagePrompt": "Stock photo of technology"},
  {"title": "Architecture Flow", "layout": "DIAGRAM_EXPLANATION", "mermaidCode": "graph TD; A-->B;", "detailedExplanation": "This explains the flow."}
]`;

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite',
    systemInstruction,
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const prompt = `Convert these lecture notes into presentation slides:\n\n${markdownContent}`;
  
  const result = await model.generateContent(prompt);
  
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (err: any) {
    throw new Error('Failed to parse LLM response into slide JSON:\n' + raw.slice(0, 300) + '\n' + err.message);
  }
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.error('Error fetching image (possibly timed out):', err);
    return null;
  }
}

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

  // 1. Summarize notes to slide JSON
  const slides = await summarizeNotesToSlides(markdownContent);

  // 2. Generate PPTX
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';

  // Define Premium Dark Master Slide
  pres.defineSlideMaster({
    title: "PREMIUM_DARK",
    background: { color: "0F172A" }, // Tailwind slate-900
    slideNumber: { x: "95%", y: "95%", fontSize: 10, color: "64748B", fontFace: "Segoe UI" },
    objects: [
      // Top accent bar
      { rect: { x: 0, y: 0, w: "100%", h: 0.1, fill: { color: "3B82F6" } } },
      // Bottom subtle bar
      { rect: { x: 0, y: "98%", w: "100%", h: 0.15, fill: { color: "1E293B" } } },
      // Footer text
      { text: { text: subjectName, options: { x: 0.3, y: "94.5%", w: "50%", h: 0.3, fontSize: 10, color: "64748B", fontFace: "Segoe UI" } } }
    ]
  });
  
  // Title Slide
  const titleSlide = pres.addSlide({ masterName: "PREMIUM_DARK" });
  titleSlide.addText(`${subjectName}`, { x: 0.5, y: "35%", w: "90%", h: 1.5, fontSize: 48, bold: true, align: "center", color: "F8FAFC", fontFace: "Segoe UI" });
  titleSlide.addText(`Module ${moduleNumber}: ${moduleTitle}`, { x: 0.5, y: "55%", w: "90%", h: 1, fontSize: 28, align: "center", color: "94A3B8", fontFace: "Segoe UI" });

  // Content Slides
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const presSlide = pres.addSlide({ masterName: "PREMIUM_DARK" });
    
    // Slide Title Accent Block
    presSlide.addShape(pres.ShapeType.rect, { x: 0.4, y: 0.45, w: 0.1, h: 0.5, fill: { color: "3B82F6" } });
    
    // Slide Title
    presSlide.addText(slide.title || "Slide", { x: 0.6, y: 0.3, w: "90%", h: 0.8, fontSize: 32, bold: true, color: "F8FAFC", fontFace: "Segoe UI" });
    
    const layout = slide.layout || "TEXT_IMAGE";

    if (layout === "TEXT_IMAGE") {
      if (slide.points && Array.isArray(slide.points) && slide.points.length > 0) {
        const bulletPoints = slide.points.map((p: string) => ({ text: p, options: { bullet: { type: 'bullet' }, breakLine: true } }));
        
        const textWidth = slide.imagePrompt ? "45%" : "85%";
        presSlide.addText(bulletPoints, { 
          x: 0.6, 
          y: 1.5, 
          w: textWidth, 
          h: "70%", 
          fontSize: 20, 
          color: "E2E8F0", 
          fontFace: "Segoe UI",
          valign: "top",
          lineSpacing: 32
        });
      }

      if (slide.imagePrompt) {
        const encodedPrompt = encodeURIComponent(slide.imagePrompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=600&nologo=true`;
        
        try {
          const base64Data = await fetchImageAsBase64(imageUrl);
          if (base64Data) {
            presSlide.addImage({
              data: base64Data,
              x: "52%",
              y: 1.5,
              w: "43%",
              h: "65%",
              sizing: { type: "cover", w: "43%", h: "65%" }
            });
          }
        } catch (e: any) {
          console.error("Failed to add image to slide:", e);
        }
      }
    } else if (layout === "DIAGRAM_EXPLANATION") {
      if (slide.detailedExplanation) {
        presSlide.addText(slide.detailedExplanation, {
          x: 0.6,
          y: 1.3,
          w: "85%",
          h: 1.0,
          fontSize: 18,
          color: "E2E8F0",
          fontFace: "Segoe UI",
          valign: "top"
        });
      }

      if (slide.mermaidCode) {
        try {
          // Inject dark theme settings into Mermaid code if not present
          let code = slide.mermaidCode.trim();
          if (!code.startsWith('%%{init:')) {
            code = `%%{init: {'theme': 'dark', 'themeVariables': { 'darkMode': true }}}%%\n${code}`;
          }
          
          const base64Code = Buffer.from(code).toString('base64');
          const mermaidUrl = `https://mermaid.ink/img/${base64Code}?bgColor=0F172A`; 
          
          const base64Data = await fetchImageAsBase64(mermaidUrl);
          if (base64Data) {
            presSlide.addImage({
              data: base64Data,
              x: "10%",
              y: 2.3,
              w: "80%",
              h: 3.0,
              sizing: { type: "contain", w: "80%", h: 3.0 }
            });
          }
        } catch (e: any) {
          console.error("Failed to add mermaid diagram to slide:", e);
        }
      }
    }
  }

  await pres.writeFile({ fileName: outputPath });

  return outputPath;
}
