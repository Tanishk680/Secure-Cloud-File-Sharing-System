import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { resolveShare } from '../services/api';
import { getIdToken } from '../services/auth';

export default function SharedFile() {
  const { shareId } = useParams();
  const [state, setState] = useState('loading'); // loading | ok | error
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        let token = null;
        try {
          token = await getIdToken();
        } catch (e) {
          token = null; // unauthenticated is fine for link shares
        }
        const result = await resolveShare(shareId, token);
        setData(result);
        setState('ok');
      } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.error || err.message || 'Unable to access this share';
        if (status === 403) setError(msg);
        else if (status === 401) setError('You must be logged in to access this shared file.');
        else if (status === 404) setError('This share link does not exist.');
        else setError(msg);
        setState('error');
      }
    }
    load();
  }, [shareId]);

  return (
    <div className="container" style={{ maxWidth: 560, marginTop: 60 }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Shared File</h2>
        {state === 'loading' && <p className="muted">Validating share…</p>}
        {state === 'error' && <div className="error">{error}</div>}
        {state === 'ok' && data && (
          <div>
            <p><strong>File:</strong> {data.file.fileName}</p>
            <p className="muted">Size: {(data.file.fileSize / 1024).toFixed(1)} KB</p>
            <a className="btn" href={data.downloadUrl} target="_blank" rel="noreferrer">
              Download File
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
