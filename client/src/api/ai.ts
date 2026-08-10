/**
 * ai.ts
 * ─────
 * Frontend API client for AI University Notes Generator.
 */

const API_BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1/ai`;

export interface Subject {
  id: string;
  name: string;
  short: string;
  description: string;
  color: string;
  icon: string;
  totalModules: number;
  subjectType?: 'default' | 'custom';
}

export interface SubjectStatus {
  subject: Subject;
  files: { syllabus: string[]; reference: string[] };
  docxStatus: Record<number, boolean>;
  pptxStatus: Record<number, boolean>;
  hasSyllabus: boolean;
  hasReference: boolean;
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

export async function getSubjects(): Promise<Subject[]> {
  const res = await fetch(`${API_BASE}/subjects`);
  if (!res.ok) throw new Error('Failed to fetch subjects');
  const { data } = await res.json();
  return data;
}

export async function getSubjectStatus(subjectId: string): Promise<SubjectStatus> {
  const res = await fetch(`${API_BASE}/subjects/${subjectId}/status`);
  if (!res.ok) throw new Error('Failed to fetch subject status');
  const { data } = await res.json();
  return data;
}

export async function uploadSubjectFile(
  subjectId: string,
  docType: 'syllabus' | 'reference',
  file: File
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('docType', docType);

  const res = await fetch(`${API_BASE}/subjects/${subjectId}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to upload file');
  }
}

export async function deleteSubjectFile(
  subjectId: string,
  docType: 'syllabus' | 'reference',
  fileName: string
): Promise<void> {
  const enc = encodeURIComponent(fileName);
  const res = await fetch(`${API_BASE}/subjects/${subjectId}/files/${docType}/${enc}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete file');
}

export async function planModuleNotes(subjectId: string, moduleNum: number): Promise<ModulePlan> {
  const res = await fetch(`${API_BASE}/subjects/${subjectId}/modules/${moduleNum}/plan`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to plan module');
  }
  const { data } = await res.json();
  return data;
}

type SSECallback = (event: {
  type: string;
  lectureNumber?: number;
  lectureTitle?: string;
  chunk?: string;
  docxUrl?: string;
  pptxUrl?: string;
  message?: string;
}) => void;

export function streamModuleNotes(
  subjectId: string,
  moduleNum: number,
  plan: ModulePlan,
  onEvent: SSECallback,
  onDone: () => void,
  onError: (err: string) => void
): AbortController {
  const abortCtrl = new AbortController();

  fetch(`${API_BASE}/subjects/${subjectId}/modules/${moduleNum}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
    signal: abortCtrl.signal,
  })
    .then(async (response) => {
      if (!response.ok || !response.body) {
        throw new Error(`Server returned ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? ''; // keep the incomplete part

        for (const part of parts) {
          const line = part.trim();
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'error') {
                onError(data.message || 'Server error');
              } else if (data.type === 'done') {
                onDone();
              } else {
                onEvent(data);
              }
            } catch (err) {
              console.error('SSE parse error', err, line);
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err.message || 'Stream failed');
      }
    });

  return abortCtrl;
}

/** Regenerate and download the module DOCX from server-stored markdown. */
export async function downloadModuleDocx(subjectId: string, moduleNum: number): Promise<void> {
  const res = await fetch(`${API_BASE}/subjects/${subjectId}/modules/${moduleNum}/docx`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'DOCX download failed' }));
    throw new Error(err.error || 'DOCX download failed');
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] ?? `Module_${moduleNum}_Notes.docx`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Download the module PPTX directly via API without regenerating. */
export async function downloadModulePptx(subjectId: string, moduleNum: number): Promise<void> {
  const res = await fetch(`${API_BASE}/subjects/${subjectId}/modules/${moduleNum}/pptx`, {
    method: 'GET',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'PPTX download failed' }));
    throw new Error(err.error || 'PPTX download failed');
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] ?? `Module_${moduleNum}_Presentation.pptx`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Regenerate and download the module PPTX from server-stored markdown. */
export async function regenerateModulePptx(subjectId: string, moduleNum: number): Promise<void> {
  const res = await fetch(`${API_BASE}/subjects/${subjectId}/modules/${moduleNum}/pptx`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'PPTX regeneration failed' }));
    throw new Error(err.error || 'PPTX regeneration failed');
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] ?? `Module_${moduleNum}_Presentation.pptx`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
