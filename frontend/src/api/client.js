const BASE = import.meta.env.VITE_API_BASE || '/api';

export function getSessionToken() {
  return sessionStorage.getItem('government_session_token') || '';
}
export function setSessionToken(token) {
  sessionStorage.setItem('government_session_token', token);
}
export function clearSessionToken() {
  sessionStorage.removeItem('government_session_token');
}

async function request(path, { method = 'GET', body, admin = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (admin) headers.Authorization = `Bearer ${getSessionToken()}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const error = new Error(json?.error?.message || `Request failed (${res.status})`);
    error.details = json?.error?.details || [];
    throw error;
  }
  return json.data;
}

async function uploadImage(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);
  const res = await fetch(`${BASE}/uploads`, { method: 'POST', body: formData });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json?.error?.message || `Upload failed (${res.status})`);
  }
  return json.data;
}

async function transcribeAudio(audioFile) {
  const formData = new FormData();
  formData.append('audio', audioFile);
  const res = await fetch(`${BASE}/transcriptions`, { method: 'POST', body: formData });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json?.error?.message || `Transcription failed (${res.status})`);
  }
  return json.data;
}

export const api = {
  uploadImage,
  transcribeAudio,
  submitReport: (payload) => request('/reports', { method: 'POST', body: payload }),
  track: (code) => request(`/track/${encodeURIComponent(code)}`),
  departments: () => request('/departments'),
  // government
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  listReports: (params = {}) =>
    request(`/reports?${new URLSearchParams(params)}`, { admin: true }),
  reportDetail: (id) => request(`/reports/${id}`, { admin: true }),
  updateReport: (id, body) => request(`/reports/${id}`, { method: 'PATCH', body, admin: true }),
  updateDuplicateLink: (id, body) => request(`/reports/${id}/duplicate-link`, { method: 'PATCH', body, admin: true }),
  reanalyze: (id) => request(`/reports/${id}/reanalyze`, { method: 'POST', admin: true }),
  analytics: () => request('/analytics', { admin: true }),
  statusTrends: (period) => request(`/analytics/status-trends?${new URLSearchParams({ period })}`, { admin: true }),
};

export function dashboardSocketUrl() {
  const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
  return `${proto}${location.host}/ws/dashboard`;
}
