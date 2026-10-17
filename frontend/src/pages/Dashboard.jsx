import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listFiles, getDownloadUrl, deleteFile } from '../services/api';
import ShareDialog from '../components/ShareDialog';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [shareFile, setShareFile] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setFiles(await listFiles());
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDownload(fileId) {
    setError('');
    try {
      const url = await getDownloadUrl(fileId);
      window.open(url, '_blank');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Download failed');
    }
  }

  async function handleDelete(fileId, fileName) {
    if (!window.confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    setError('');
    try {
      await deleteFile(fileId);
      setMessage(`Deleted "${fileName}".`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Delete failed');
    }
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>My Files</h2>
        <button className="btn" onClick={() => navigate('/upload')}>Upload File</button>
      </div>
      <div className="spacer" />
      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      {loading ? (
        <p className="muted">Loading files…</p>
      ) : files.length === 0 ? (
        <div className="card center">
          <p className="muted">You have not uploaded any files yet.</p>
          <button className="btn" onClick={() => navigate('/upload')}>Upload your first file</button>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.fileId}>
                  <td>{f.fileName}</td>
                  <td>{formatSize(f.fileSize)}</td>
                  <td>{new Date(f.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="actions">
                      <button className="btn small" onClick={() => handleDownload(f.fileId)}>Download</button>
                      <button className="btn small secondary" onClick={() => setShareFile(f)}>Share</button>
                      <button className="btn small danger" onClick={() => handleDelete(f.fileId, f.fileName)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {shareFile && <ShareDialog file={shareFile} onClose={() => setShareFile(null)} />}
    </div>
  );
}
