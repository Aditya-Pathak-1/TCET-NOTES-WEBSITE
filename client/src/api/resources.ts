import { apiGet, apiPut, apiDelete, apiUpload } from './client';
import type { Resource, ResourceType } from '../types';

export const getResources = (subjectId: string) =>
  apiGet<Resource[]>(`/subjects/${subjectId}/resources`);

export const createResource = (
  subjectId: string,
  title: string,
  type: ResourceType,
  file?: File
) => {
  const fd = new FormData();
  fd.append('title', title);
  fd.append('type', type);
  if (file) fd.append('file', file);
  return apiUpload<Resource>(`/subjects/${subjectId}/resources`, fd);
};

export const updateResource = (id: string, title: string, file?: File) => {
  const fd = new FormData();
  fd.append('title', title);
  if (file) fd.append('file', file);
  return apiUpload<Resource>(`/resources/${id}`, fd, 'PUT');
};

export const deleteResource = (id: string) =>
  apiDelete(`/resources/${id}`);

/** Returns the full URL to stream/view a resource inline */
export const getViewUrl = (id: string) => `/api/v1/resources/${id}/view`;

/** Returns the full URL to download a resource */
export const getDownloadUrl = (id: string) => `/api/v1/resources/${id}/download`;
