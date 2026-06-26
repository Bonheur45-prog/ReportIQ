import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, FileText, Zap, TrendingUp, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Card, Badge, Spinner, Button } from '../components/UI';
import styles from './Dashboard.module.css';

const PLAN_LIMITS = { trial: 25, starter: 30, growth: 100, enterprise: Infinity };

export default function Dashboard() {
  const { company, user } = useAuth();
  const [stats,   setStats]   = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [sitesRes, reportsRes] = await Promise.all([
          api.get('/sites'),
          api.get('/reports?limit=5'),
        ]);
        const sitesData = sitesRes.data.data ?? sitesRes.data;
        const reportsData = reportsRes.data.data ?? reportsRes.data;
        setStats({ siteCount: sitesData.count || 0, reportCount: reportsData.total || reportsData.reports?.length || 0 });
        setReports(reportsData.reports || []);
      } catch (error) {
        setStats({ siteCount: 0, reportCount: 0 });
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const usageCount = company?.usage?.reportsThisMonth || 0;
  const planLimit  = PLAN_LIMITS[company?.plan] || 25;
  const usagePct   = planLimit === Infinity ? 0 : Math.min((usageCount / planLimit) * 100, 100);
  const isPlanActive = company ? new Date() < new Date(company.planExpiresAt) : false;

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Good {getGreeting()}, {user?.name?.split(' ')[0]}</h1>
          <p className={styles.sub}>Here's what's happening across your sites</p>
        </div>
        <Link to="/generate">
          <Button variant="gold">
            <Zap size={16} /> Generate Report
          </Button>
        </Link>
      </div>

      {/* Plan expiry warning */}
      {!isPlanActive && (
        <div className={styles.planWarning}>
          <AlertCircle size={16} />
          Your {company?.plan} plan has expired. <Link to="/settings">Renew now</Link>
        </div>
      )}

      {/* Stat cards */}
      <div className={styles.statsGrid}>
        <StatCard icon={<MapPin size={22} />} label="Active Sites" value={stats?.siteCount ?? '—'} color="navy" />
        <StatCard icon={<FileText size={22} />} label="Reports This Month" value={stats?.reportCount ?? '—'} color="gold" />
        <StatCard icon={<TrendingUp size={22} />} label="Plan" value={company?.plan} color="green" badge={isPlanActive ? 'Active' : 'Expired'} />
      </div>

      {/* Usage bar */}
      {planLimit !== Infinity && (
        <Card className={styles.usageCard}>
          <div className={styles.usageHeader}>
            <span className={styles.usageLabel}>Monthly Usage</span>
            <span className={styles.usageCount}>{usageCount} / {planLimit} reports</span>
          </div>
          <div className={styles.usageTrack}>
            <div
              className={styles.usageBar}
              style={{ width: `${usagePct}%`, background: usagePct > 80 ? 'var(--red)' : 'var(--navy)' }}
            />
          </div>
          {usagePct > 80 && (
            <p className={styles.usageWarn}>
              You're running low. <Link to="/settings">Upgrade your plan</Link>
            </p>
          )}
        </Card>
      )}

      {/* Recent reports */}
      <Card>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Reports</h2>
          <Link to="/reports" className={styles.seeAll}>See all</Link>
        </div>
        {reports.length === 0 ? (
          <p className={styles.noReports}>No reports generated yet. <Link to="/generate">Generate your first one.</Link></p>
        ) : (
          <div className={styles.reportList}>
            {reports.map(r => (
              <div key={r._id} className={styles.reportRow}>
                <div>
                  <div className={styles.reportSite}>{r.site?.name}</div>
                  <div className={styles.reportDate}>{r.date}</div>
                </div>
                <Badge variant={r.status === 'approved' ? 'success' : r.status === 'reviewed' ? 'info' : 'default'}>
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, color, badge }) {
  return (
    <Card className={styles.statCard}>
      <div className={`${styles.statIcon} ${styles[`icon_${color}`]}`}>{icon}</div>
      <div className={styles.statValue}>{String(value).charAt(0).toUpperCase() + String(value).slice(1)}</div>
      <div className={styles.statLabel}>{label}</div>
      {badge && <Badge variant="success" >{badge}</Badge>}
    </Card>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}