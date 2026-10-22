import axios from 'axios';
import { getIdToken } from './auth';
import { API_BASE_URL } from './config';

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(async (config) => {
  try {
    const token = await getIdToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    // Not authenticated; let the request proceed unauthenticated
  }
  return config;
});

export async function requestUploadUrl({ fileName, contentType, fileSize }) {
  const { data } = await api.post('/files/upload-url', { fileName, contentType, fileSize });
  return data;
}

export async function confirmUpload(payload) {
  const { data } = await api.post('/files', payload);
  return data;
}

export async function listFiles() {
  const { data } = await api.get('/files');
  return data.files;
}

export async function getDownloadUrl(fileId) {
  const { data } = await api.get(`/files/${fileId}/download-url`);
  return data.downloadUrl;
}

export async function deleteFile(fileId) {
  const { data } = await api.delete(`/files/${fileId}`);
  return data;
}

export async function createShare(fileId, { shareType, recipientId, expiry }) {
  const { data } = await api.post(`/files/${fileId}/shares`, { shareType, recipientId, expiry });
  return data.share;
}

export async function listShares(fileId) {
  const { data } = await api.get(`/files/${fileId}/shares`);
  return data.shares;
}

export async function revokeShare(shareId) {
  const { data } = await api.delete(`/shares/${shareId}`);
  return data;
}

export async function resolveShare(shareId, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const { data } = await api.get(`/shares/${shareId}`, { headers });
  return data;
}

export function uploadToS3(url, file, contentType, onProgress) {
  return axios.put(url, file, {
    headers: { 'Content-Type': contentType },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
}

export default api;
