export type ResourceType =
  | 'syllabus'
  | 'notes'
  | 'material'
  | 'pdf'
  | 'docx'
  | 'ppt'
  | 'image'
  | 'flashcard-deck';

export interface Subject {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string | null;
}

export interface Resource {
  id: string;
  subjectId: string;
  title: string;
  type: ResourceType;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  updatedAt: string;
  ownerId: string | null;
}

export interface Flashcard {
  id: string;
  deckResourceId: string;
  question: string;
  answer: string;
  sortOrder: number;
  createdAt: string;
}

export interface SearchResult {
  subjects: Subject[];
  resources: (Resource & { subjectName: string; subjectColor: string })[];
}

// Form / DTO types used by the API layer
export interface CreateSubjectDto {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateSubjectDto {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface CreateResourceDto {
  title: string;
  type: ResourceType;
  file?: File;
}

export interface CreateFlashcardDto {
  question: string;
  answer: string;
}

export interface UpdateFlashcardDto {
  question?: string;
  answer?: string;
  order?: number;
}

// Subject color options
export const SUBJECT_COLORS = [
  { label: 'Indigo',  value: '#6366f1' },
  { label: 'Violet',  value: '#8b5cf6' },
  { label: 'Sky',     value: '#0ea5e9' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber',   value: '#f59e0b' },
  { label: 'Rose',    value: '#f43f5e' },
  { label: 'Teal',    value: '#14b8a6' },
  { label: 'Orange',  value: '#f97316' },
] as const;

export const SUBJECT_ICONS = ['📚', '🔬', '🧮', '🌍', '🎨', '💡', '⚗️', '🖥️', '📐', '🎵'];

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  syllabus: 'Syllabus',
  notes: 'Notes',
  material: 'Material',
  pdf: 'PDF',
  docx: 'Document',
  ppt: 'Presentation',
  image: 'Image',
  'flashcard-deck': 'Flashcard Deck',
};
