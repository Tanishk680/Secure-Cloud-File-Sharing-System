import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

  useEffect(() => {
    async function check() {
      try {
        await getCurrentUser();
        const mail = await getCurrentUserEmail();
        setEmail(mail || '');
        setAuthState('authed');
      } catch (err) {
        setAuthState('guest');
      }
    }
    check();
  }, []);

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
