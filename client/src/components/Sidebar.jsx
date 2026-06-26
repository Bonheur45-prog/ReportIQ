import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MapPin, FileText, Zap, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './Sidebar.module.css';

const NAV = [
  { to: '/dashboard',  label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sites',      label: 'Sites',     icon: MapPin },
  { to: '/generate',   label: 'Generate',  icon: Zap },
  { to: '/reports',    label: 'Reports',   icon: FileText },
  { to: '/settings',   label: 'Settings',  icon: Settings },
];

export default function Sidebar() {
  const { user, company, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoIcon}>⚡</span>
        <div>
          <div className={styles.logoName}>ReportIQ</div>
          <div className={styles.logoSub}>Site Report Platform</div>
        </div>
      </div>

      {/* Company badge */}
      <div className={styles.companyBadge}>
        <div className={styles.companyName}>{company?.name}</div>
        <div className={styles.companyPlan}>{company?.plan} plan</div>
      </div>

      {/* Nav links */}
      <nav className={styles.nav}>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout at bottom */}
      <div className={styles.bottom}>
        <div className={styles.user}>
          <div className={styles.userAvatar}>{user?.name?.[0]?.toUpperCase()}</div>
          <div>
            <div className={styles.userName}>{user?.name}</div>
            <div className={styles.userRole}>{user?.role}</div>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout} title="Log out">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
