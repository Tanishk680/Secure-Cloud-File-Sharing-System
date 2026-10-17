import { useEffect, useState } from 'react';
import { listFiles, listShares, revokeShare } from '../services/api';
import { SHARE_BASE_URL } from '../services/config';

function shareState(share) {
  if (share.revoked) return 'revoked';
  const now = Math.floor(Date.now() / 1000);
  if (share.expiresAt && now > share.expiresAt) return 'expired';
  return 'active';
}

export default function Shares() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const files = await listFiles();
      const all = [];
      for (const f of files) {
        const s = await listShares(f.fileId);
        for (const share of s) {
          all.push({ ...share, fileName: f.fileName });
        }
      }
      setShares(all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load shares');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRevoke(shareId) {
    if (!window.confirm('Revoke this share? New download requests will be denied.')) return;
    setError('');
    try {
      await revokeShare(shareId);
      setMessage('Share revoked.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Revoke failed');
    }
  }

  return (
    <div className="container">
      <h2>Share Management</h2>
      <p className="muted">
        Note: revoking or expiring a share blocks new downloads. A pre-signed URL already issued
        remains valid until its short lifetime (~5 minutes) elapses.
      </p>
      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      {loading ? (
        <p className="muted">Loading shares…</p>
      ) : shares.length === 0 ? (
        <div className="card center">
          <p className="muted">No shares created yet.</p>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Mode</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shares.map((s) => {
                const st = shareState(s);
                return (
                  <tr key={s.shareId}>
                    <td>{s.fileName}</td>
                    <td>{s.shareType === 'link' ? 'Link' : 'Recipient'}</td>
                    <td>{new Date(s.expiresAt * 1000).toLocaleString()}</td>
                    <td><span className={`badge ${st}`}>{st}</span></td>
                    <td>
                      <div className="actions">
                        {s.shareType === 'link' && (
                          <button
                            className="btn small secondary"
                            onClick={() => navigator.clipboard.writeText(`${SHARE_BASE_URL}/shared/${s.shareId}`)}
                          >
                            Copy Link
                          </button>
                        )}
                        {st === 'active' && (
                          <button className="btn small danger" onClick={() => handleRevoke(s.shareId)}>
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
