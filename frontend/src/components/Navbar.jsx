import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../services/auth';

export default function Navbar({ email }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <h1>Secure Cloud Files</h1>
        <div className="links">
          <Link to="/">Dashboard</Link>
          <Link to="/upload">Upload</Link>
          <Link to="/shares">Shares</Link>
          {email && <span className="muted">{email}</span>}
          <button className="btn secondary small" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </nav>
  );
}
