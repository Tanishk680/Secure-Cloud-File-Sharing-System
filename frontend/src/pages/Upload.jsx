import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestUploadUrl, confirmUpload, uploadToS3 } from '../services/api';

const MAX_SIZE = 50 * 1024 * 1024;

export default function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  function handleSelect(e) {
    const selected = e.target.files[0];
    setError('');
    setStatus('');
    setProgress(0);
    if (selected && selected.size > MAX_SIZE) {
      setError('File exceeds the 50 MB limit.');
      setFile(null);
      return;
    }
    setFile(selected);
  }

  async function handleUpload() {
    if (!file) return;
    setError('');
    setUploading(true);
    setStatus('Requesting upload URL…');
    const contentType = file.type || 'application/octet-stream';
    try {
      const { uploadUrl, fileId, s3Key } = await requestUploadUrl({
        fileName: file.name,
        contentType,
        fileSize: file.size,
      });

      setStatus('Uploading to S3…');
      await uploadToS3(uploadUrl, file, contentType, setProgress);

      setStatus('Finalizing…');
      await confirmUpload({
        fileId,
        s3Key,
        fileName: file.name,
        contentType,
        fileSize: file.size,
      });

      setStatus('Upload complete.');
      setTimeout(() => navigate('/'), 800);
    } catch (err) {
      const detail =
        err.response?.data?.error ||
        (err.response ? `Request failed (${err.response.status})` : '') ||
        err.message ||
        'Upload failed';
      setError(`Upload failed: ${detail}${err.code ? ` [${err.code}]` : ''}`);
      setStatus('');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <h2>Upload File</h2>
      <div className="card">
        {error && <div className="error">{error}</div>}
        {status && <div className="success">{status}</div>}

        <label>Choose a file (max 50 MB)</label>
        <input type="file" onChange={handleSelect} disabled={uploading} />

        {file && (
          <p className="muted">
            {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        )}

        {uploading && (
          <div style={{ marginTop: 12 }}>
            <div style={{ background: '#e2e8f0', borderRadius: 6, height: 10, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, background: 'var(--primary)', height: '100%' }} />
            </div>
            <p className="muted">{progress}%</p>
          </div>
        )}

        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
          <button className="btn secondary" onClick={() => navigate('/')} disabled={uploading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
