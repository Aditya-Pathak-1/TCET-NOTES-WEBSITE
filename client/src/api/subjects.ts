import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { Subject, CreateSubjectDto, UpdateSubjectDto } from '../types';

export const getSubjects = () =>
  apiGet<Subject[]>('/subjects');

export const getSubject = (id: string) =>
  apiGet<Subject>(`/subjects/${id}`);

export const createSubject = (dto: CreateSubjectDto) =>
  apiPost<Subject>('/subjects', dto);

export const updateSubject = (id: string, dto: UpdateSubjectDto) =>
  apiPut<Subject>(`/subjects/${id}`, dto);

export const deleteSubject = (id: string) =>
  apiDelete(`/subjects/${id}`);
