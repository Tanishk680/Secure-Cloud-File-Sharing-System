import { useState } from 'react';
import { createShare } from '../services/api';
import { SHARE_BASE_URL } from '../services/config';

export default function ShareDialog({ file, onClose }) {
  const [shareType, setShareType] = useState('link');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [expiry, setExpiry] = useState('24h');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shareLink, setShareLink] = useState('');

  async function handleCreate() {
    setError('');
    setLoading(true);
    try {
      const share = await createShare(file.fileId, {
        shareType,
        recipientEmail: shareType === 'recipient' ? recipientEmail.trim() : undefined,
        expiry,
      });
      setShareLink(`${SHARE_BASE_URL}/shared/${share.shareId}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create share');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Share "{file.fileName}"</h3>
        {error && <div className="error">{error}</div>}

        {shareLink ? (
          <div>
            <div className="success">Share created successfully.</div>
            <label>Share link</label>
            <input readOnly value={shareLink} onFocus={(e) => e.target.select()} />
            <div className="actions">
              <button
                className="btn"
                onClick={() => navigator.clipboard.writeText(shareLink)}
              >
                Copy Link
              </button>
              <button className="btn secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : (
          <div>
            <label>Sharing mode</label>
            <select value={shareType} onChange={(e) => setShareType(e.target.value)}>
              <option value="link">Anyone with the link</option>
              <option value="recipient">Specific authenticated recipient</option>
            </select>

            {shareType === 'recipient' && (
              <>
                <label>Recipient email</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="recipient@example.com"
                />
              </>
            )}

            <label>Expiry</label>
            <select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
              <option value="1h">1 hour</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
            </select>

            <div className="actions">
              <button className="btn" onClick={handleCreate} disabled={loading}>
                {loading ? 'Creating…' : 'Create Share'}
              </button>
              <button className="btn secondary" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
