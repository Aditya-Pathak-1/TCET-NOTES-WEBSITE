/**
 * subjectRegistry.ts
 * ──────────────────
 * Single source of truth for the 6 fixed subjects.
 * No database required — subjects are hardcoded here.
 */

import prisma from '../db/database';

export interface SubjectBase {
  id: string;
  name: string;
  short: string;
  description: string;
  color: string;
  icon: string;
  totalModules: number;
  subjectType?: 'default' | 'custom';
}

export const FIXED_SUBJECTS: SubjectBase[] = [
  {
    id: 'fiot',
    name: 'Fundamentals of Internet of Things',
    short: 'FIOT',
    description: 'Sensors, actuators, IoT protocols, and smart systems',
    color: '#6366f1',
    icon: '🌐',
    totalModules: 6,
    subjectType: 'default',
  },
  {
    id: 'dsca',
    name: 'Digital System and Computer Architecture',
    short: 'DSCA',
    description: 'Boolean algebra, combinational circuits, memory, and CPU design',
    color: '#0ea5e9',
    icon: '💻',
    totalModules: 6,
    subjectType: 'default',
  },
  {
    id: 'math3',
    name: 'Mathematics III',
    short: 'MATH-III',
    description: 'Laplace transforms, Fourier series, complex variables, and numerical methods',
    color: '#10b981',
    icon: '📐',
    totalModules: 6,
    subjectType: 'default',
  },
  {
    id: 'ds',
    name: 'Data Structures',
    short: 'DS',
    description: 'Arrays, linked lists, trees, graphs, sorting and searching algorithms',
    color: '#f59e0b',
    icon: '🗂️',
    totalModules: 6,
    subjectType: 'default',
  },
  {
    id: 'aad',
    name: 'Aptitude and Attitude Development',
    short: 'AAD',
    description: 'Quantitative aptitude, logical reasoning, and verbal ability',
    color: '#ec4899',
    icon: '🧠',
    totalModules: 6,
    subjectType: 'default',
  },
  {
    id: 'uhv',
    name: 'Universal Human Values',
    short: 'UHV',
    description: 'Ethics, values, human relationships, and professional conduct',
    color: '#8b5cf6',
    icon: '🌱',
    totalModules: 6,
    subjectType: 'default',
  },
];

export async function getSubjectById(id: string): Promise<SubjectBase | undefined> {
  const fixed = FIXED_SUBJECTS.find(s => s.id === id);
  if (fixed) return fixed;

  const dbSubject = await prisma.subject.findUnique({ where: { id } });
  if (!dbSubject) return undefined;

  return {
    ...dbSubject,
    description: dbSubject.description || '',
    subjectType: dbSubject.subjectType as 'default' | 'custom',
  };
}

export async function getAllSubjects(): Promise<SubjectBase[]> {
  const dbSubjects = await prisma.subject.findMany({ orderBy: { createdAt: 'desc' } });
  const mappedDbSubjects: SubjectBase[] = dbSubjects.map(s => ({
    ...s,
    description: s.description || '',
    subjectType: s.subjectType as 'default' | 'custom',
  }));

  return [...FIXED_SUBJECTS, ...mappedDbSubjects];
}
