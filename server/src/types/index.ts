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
  short: string;
  description: string | null;
  color: string;
  icon: string;
  totalModules: number;
  subjectType: string;
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
  sortOrder: number;  // stored as sortOrder in DB (Prisma-safe field name)
  createdAt: string;
}

export interface CreateSubjectDto {
  name: string;
  short?: string;
  description?: string;
  color?: string;
  icon?: string;
  totalModules?: number;
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
}

export interface UpdateResourceDto {
  title?: string;
}

export interface CreateFlashcardDto {
  question: string;
  answer: string;
  order?: number;  // maps to sortOrder in DB
}

export interface UpdateFlashcardDto {
  question?: string;
  answer?: string;
  order?: number;  // maps to sortOrder in DB
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  details?: string;
}

export interface SearchResult {
  subjects: Subject[];
  resources: (Resource & { subjectName: string; subjectColor: string })[];
}
