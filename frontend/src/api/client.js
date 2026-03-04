import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Chat
export const sendMessage = (sessionId, messages) =>
  api.post('/chat', { session_id: sessionId, messages }).then(r => r.data);

// Config
export const getConfig    = ()     => api.get('/config').then(r => r.data);
export const updateConfig = (data) => api.put('/config', data).then(r => r.data);
export const compactGuidelines = () => api.post('/config/compact').then(r => r.data);

// Workflows
export const getWorkflows   = ()         => api.get('/workflows').then(r => r.data);
export const createWorkflow = (data)     => api.post('/workflows', data).then(r => r.data);
export const updateWorkflow = (id, data) => api.patch(`/workflows/${id}`, data).then(r => r.data);
export const deleteWorkflow = (id)       => api.delete(`/workflows/${id}`).then(r => r.data);

// Mistakes (raw reports)
export const getMistakes    = (archived = false) =>
  api.get('/mistakes', { params: { archived } }).then(r => r.data);
export const reportMistake  = (data) => api.post('/mistakes', data).then(r => r.data);
export const fixMistake     = (id)   => api.post(`/mistakes/${id}/fix`).then(r => r.data);
export const archiveMistake = (id)   => api.delete(`/mistakes/${id}/archive`).then(r => r.data);

// Corrections (deduplicated active rules)
export const getCorrections    = (includeCompacted = false) =>
  api.get('/mistakes/corrections', { params: { include_compacted: includeCompacted } }).then(r => r.data);
export const updateCorrection  = (id, data) => api.patch(`/mistakes/corrections/${id}`, data).then(r => r.data);
export const deleteCorrection  = (id)       => api.delete(`/mistakes/corrections/${id}`).then(r => r.data);

// Logs
export const getLogs  = (limit = 100) =>
  api.get('/logs', { params: { limit } }).then(r => r.data);
export const getStats = () => api.get('/logs/stats').then(r => r.data);

// Versions
export const getVersions      = ()         => api.get('/versions').then(r => r.data);
export const createVersion    = (data)     => api.post('/versions', data).then(r => r.data);
export const promoteVersion   = (id)       => api.post(`/versions/${id}/promote`).then(r => r.data);
export const deleteVersion    = (id)       => api.delete(`/versions/${id}`).then(r => r.data);

// Documents
export const parseDocument = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/documents/parse', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data);
};
export const applyDocument = (data) => api.post('/documents/apply', data).then(r => r.data);
