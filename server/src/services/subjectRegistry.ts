/**
 * subjectRegistry.ts
 * ──────────────────
 * Single source of truth for the 6 fixed subjects.
 * No database required — subjects are hardcoded here.
 */

export interface FixedSubject {
  id: string;        // URL-safe identifier
  name: string;      // Full subject name
  short: string;     // Abbreviation shown in UI
  description: string;
  color: string;     // Tailwind-compatible hex
  icon: string;      // Emoji icon
  totalModules: number;
}

export const FIXED_SUBJECTS: FixedSubject[] = [
  {
    id: 'fiot',
    name: 'Fundamentals of Internet of Things',
    short: 'FIOT',
    description: 'Sensors, actuators, IoT protocols, and smart systems',
    color: '#6366f1',
    icon: '🌐',
    totalModules: 6,
  },
  {
    id: 'dsca',
    name: 'Digital System and Computer Architecture',
    short: 'DSCA',
    description: 'Boolean algebra, combinational circuits, memory, and CPU design',
    color: '#0ea5e9',
    icon: '💻',
    totalModules: 6,
  },
  {
    id: 'math3',
    name: 'Mathematics III',
    short: 'MATH-III',
    description: 'Laplace transforms, Fourier series, complex variables, and numerical methods',
    color: '#10b981',
    icon: '📐',
    totalModules: 6,
  },
  {
    id: 'ds',
    name: 'Data Structures',
    short: 'DS',
    description: 'Arrays, linked lists, trees, graphs, sorting and searching algorithms',
    color: '#f59e0b',
    icon: '🗂️',
    totalModules: 6,
  },
  {
    id: 'aad',
    name: 'Aptitude and Attitude Development',
    short: 'AAD',
    description: 'Quantitative aptitude, logical reasoning, and verbal ability',
    color: '#ec4899',
    icon: '🧠',
    totalModules: 6,
  },
  {
    id: 'uhv',
    name: 'Universal Human Values',
    short: 'UHV',
    description: 'Ethics, values, human relationships, and professional conduct',
    color: '#8b5cf6',
    icon: '🌱',
    totalModules: 6,
  },
];

export function getSubjectById(id: string): FixedSubject | undefined {
  return FIXED_SUBJECTS.find(s => s.id === id);
}

export function getAllSubjects(): FixedSubject[] {
  return FIXED_SUBJECTS;
}
