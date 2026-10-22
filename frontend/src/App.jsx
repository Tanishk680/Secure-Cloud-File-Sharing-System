import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from 'aws-amplify/auth';
import { configureAmplify } from './services/config';
import { getCurrentUserEmail } from './services/auth';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import SharedFile from './pages/SharedFile';
import Shares from './pages/Shares';

configureAmplify();

function ProtectedLayout({ children, email }) {
  return (
    <>
      <Navbar email={email} />
      {children}
    </>
  );
}

export default function App() {
  const [authState, setAuthState] = useState('checking'); // checking | authed | guest
  const [email, setEmail] = useState('');
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    setAuthState('checking');

    async function check() {
      try {
        await getCurrentUser();
        const mail = await getCurrentUserEmail();
        if (cancelled) return;
        setEmail(mail || '');
        setAuthState('authed');
      } catch (err) {
        if (cancelled) return;
        setEmail('');
        setAuthState('guest');
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (authState === 'checking') {
    return <div className="container center"><p className="muted">Loading…</p></div>;
  }

  return (
    <Routes>
      <Route path="/shared/:shareId" element={<SharedFile />} />
      <Route
        path="/login"
        element={authState === 'authed' ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          authState === 'authed' ? (
            <ProtectedLayout email={email}><Dashboard /></ProtectedLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/upload"
        element={
          authState === 'authed' ? (
            <ProtectedLayout email={email}><Upload /></ProtectedLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/shares"
        element={
          authState === 'authed' ? (
            <ProtectedLayout email={email}><Shares /></ProtectedLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
