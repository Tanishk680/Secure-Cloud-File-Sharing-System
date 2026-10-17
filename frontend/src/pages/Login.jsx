import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signIn,
  signUp,
  confirmSignUp,
  resendSignUpCode,
} from 'aws-amplify/auth';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // login | register | confirm
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn({ username: email, password });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
      setMode('confirm');
      setMessage('Registration successful. Check your email for a verification code.');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      setMode('login');
      setMessage('Account verified. You can now log in.');
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    try {
      await resendSignUpCode({ username: email });
      setMessage('A new verification code has been sent.');
    } catch (err) {
      setError(err.message || 'Could not resend code');
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, marginTop: 60 }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Secure Cloud File Sharing</h2>
        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}

        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button className="btn" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Signing in…' : 'Log In'}
            </button>
            <p className="muted center" style={{ marginTop: 12 }}>
              No account?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('register'); setError(''); setMessage(''); }}>
                Register
              </a>
            </p>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <p className="muted">Min 8 chars with upper, lower, number and symbol.</p>
            <button className="btn" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Creating…' : 'Create Account'}
            </button>
            <p className="muted center" style={{ marginTop: 12 }}>
              Have an account?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(''); setMessage(''); }}>
                Log In
              </a>
            </p>
          </form>
        )}

        {mode === 'confirm' && (
          <form onSubmit={handleConfirm}>
            <label>Verification code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} required />
            <button className="btn" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <p className="muted center" style={{ marginTop: 12 }}>
              <a href="#" onClick={(e) => { e.preventDefault(); handleResend(); }}>
                Resend code
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
