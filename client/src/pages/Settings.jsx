import { useState, useEffect } from 'react';
import { Link2, Link2Off, Save, RefreshCw, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Card, Button, Input, StatusBar } from '../components/UI';
import AISettings from './AISettings';
import styles from './Settings.module.css';

export default function Settings() {
  const { company, user, refreshMe } = useAuth();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      <DriveSection company={company} refreshMe={refreshMe} />
      <AISettings />
      <CompanySection company={company} refreshMe={refreshMe} />
      <PlanSection company={company} />
      <UploadLinkSection company={company} refreshMe={refreshMe} />
      <PasswordSection />
    </div>
  );
}

// ── Google Drive connection ───────────────────────────────────────────────────
function DriveSection({ company, refreshMe }) {
  const [connecting, setConnecting] = useState(false);
  const [code,       setCode]       = useState('');
  const [showCode,   setShowCode]   = useState(false);
  const [rootFolder, setRootFolder] = useState(company?.driveRootFolderId || '');
  const [saving,     setSaving]     = useState(false);

  const isConnected = !!company?.driveConnected;

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await api.get('/drive/auth-url');
      window.open(res.data.url, '_blank');
      setShowCode(true);
    } catch {
      toast.error('Failed to get auth URL.');
    } finally {
      setConnecting(false);
    }
  };

  const handleSubmitCode = async () => {
    if (!code.trim()) return toast.error('Paste the authorization code first.');
    setConnecting(true);
    try {
      await api.post('/drive/connect', { code: code.trim() });
      toast.success('Google Drive connected!');
      setShowCode(false);
      setCode('');
      await refreshMe();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Connection failed. Try again.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Drive? You will need to reconnect to generate reports.')) return;
    try {
      await api.delete('/drive/disconnect');
      toast.success('Google Drive disconnected.');
      await refreshMe();
    } catch {
      toast.error('Failed to disconnect.');
    }
  };

  const handleSaveRootFolder = async () => {
    if (!rootFolder.trim()) return toast.error('Enter a folder ID.');
    setSaving(true);
    try {
      await api.post('/drive/root-folder', { rootFolderId: rootFolder.trim() });
      toast.success('Root folder saved.');
      await refreshMe();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={styles.section}>
      <h2 className={styles.sectionTitle}>Google Drive</h2>

      {isConnected ? (
        <StatusBar type="success">
          <Link2 size={15} /> Google Drive is connected
        </StatusBar>
      ) : (
        <StatusBar type="warning">
          <Link2Off size={15} /> Google Drive is not connected — required for report generation
        </StatusBar>
      )}

      {!isConnected && !showCode && (
        <Button onClick={handleConnect} loading={connecting} className={styles.mt}>
          <Link2 size={15} /> Connect Google Drive
        </Button>
      )}

      {showCode && (
        <div className={styles.codeBox}>
          <p className={styles.codeHint}>A browser tab opened. Sign in with Google, then paste the code below:</p>
          <Input
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Paste authorization code here"
            autoFocus
          />
          <div className={styles.codeActions}>
            <Button variant="secondary" onClick={() => { setShowCode(false); setCode(''); }}>Cancel</Button>
            <Button onClick={handleSubmitCode} loading={connecting}>Submit Code</Button>
          </div>
        </div>
      )}

      {isConnected && (
        <>
          <div className={styles.mt}>
            <Input
              label="Root Folder ID"
              value={rootFolder}
              onChange={e => setRootFolder(e.target.value)}
              placeholder="1dPsMoA1PR0i9LRuQQnwLJiLbqj_psWKK"
              hint="The Drive folder that contains all your site folders. Open it in Drive → copy the ID from the URL."
            />
            <Button className={styles.mt} loading={saving} onClick={handleSaveRootFolder}>
              <Save size={15} /> Save Root Folder
            </Button>
          </div>
          <Button variant="danger" size="sm" className={styles.mt} onClick={handleDisconnect}>
            <Link2Off size={14} /> Disconnect Drive
          </Button>
        </>
      )}
    </Card>
  );
}

// ── Company profile ───────────────────────────────────────────────────────────
function CompanySection({ company, refreshMe }) {
  const [form,    setForm]    = useState({ name: company?.name || '', phone: company?.phone || '' });
  const [saving,  setSaving]  = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Company name is required.');
    setSaving(true);
    try {
      await api.patch('/company/profile', form);
      toast.success('Profile updated.');
      await refreshMe();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={styles.section}>
      <h2 className={styles.sectionTitle}>Company Profile</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input label="Company name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+250 7XX XXX XXX" />
        <Button type="submit" loading={saving} className={styles.saveBtn}>
          <Save size={15} /> Save Changes
        </Button>
      </form>
    </Card>
  );
}

// ── Plan info ─────────────────────────────────────────────────────────────────
function PlanSection({ company }) {
  const planExpiry   = company?.planExpiresAt ? new Date(company.planExpiresAt) : null;
  const isExpired    = planExpiry && new Date() > planExpiry;
  const daysLeft     = planExpiry ? Math.ceil((planExpiry - new Date()) / (1000 * 60 * 60 * 24)) : 0;

  const PLANS = [
    { id: 'starter',    label: 'Starter',    price: '15,000 RWF/mo', limit: '3 sites · 30 reports/mo' },
    { id: 'growth',     label: 'Growth',     price: '35,000 RWF/mo', limit: '10 sites · 100 reports/mo' },
    { id: 'enterprise', label: 'Enterprise', price: 'Custom',         limit: 'Unlimited everything' },
  ];

  return (
    <Card className={styles.section}>
      <h2 className={styles.sectionTitle}>Plan & Billing</h2>

      <div className={styles.planCurrent}>
        <div>
          <span className={styles.planName}>{company?.plan} plan</span>
          {planExpiry && (
            <span className={`${styles.planExpiry} ${isExpired ? styles.expired : ''}`}>
              {isExpired ? 'Expired' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`}
            </span>
          )}
        </div>
      </div>

      <div className={styles.plansGrid}>
        {PLANS.map(p => (
          <div key={p.id} className={`${styles.planCard} ${company?.plan === p.id ? styles.planCardActive : ''}`}>
            <div className={styles.planCardName}>{p.label}</div>
            <div className={styles.planCardPrice}>{p.price}</div>
            <div className={styles.planCardLimit}>{p.limit}</div>
            {company?.plan !== p.id && (
              <Button size="sm" variant="ghost" className={styles.planCardBtn}>
                {p.id === 'enterprise' ? 'Contact us' : 'Upgrade'}
              </Button>
            )}
          </div>
        ))}
      </div>
      <p className={styles.billingNote}>Payments via MTN MoMo. Coming soon.</p>
    </Card>
  );
}

// ── Change password ───────────────────────────────────────────────────────────
function PasswordSection() {
  const [form,   setForm]   = useState({ currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (form.newPassword.length < 8) return toast.error('New password must be at least 8 characters.');
    setSaving(true);
    try {
      await api.post('/auth/change-password', form);
      toast.success('Password changed successfully.');
      setForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={styles.section}>
      <h2 className={styles.sectionTitle}>Change Password</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label="Current password"
          type="password"
          value={form.currentPassword}
          onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
          placeholder="••••••••"
        />
        <Input
          label="New password"
          type="password"
          value={form.newPassword}
          onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
          placeholder="At least 8 characters"
        />
        <Button type="submit" loading={saving} className={styles.saveBtn}>
          <Save size={15} /> Update Password
        </Button>
      </form>
    </Card>
  );
}


// ── Field Worker Upload Link ───────────────────────────────────────────────────
function UploadLinkSection({ company, refreshMe }) {
  const [generating, setGenerating] = useState(false);
  const [copied,     setCopied]     = useState(false);

  const token     = company?.uploadToken;
  const uploadUrl = token ? `${window.location.origin}/upload/${token}` : null;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post('/upload/token/generate');
      await refreshMe();
    } catch (err) {
      toast.error('Failed to generate link.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(uploadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={styles.section}>
      <h2 className={styles.sectionTitle}>Field Worker Upload Link</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Share this link with your field workers via WhatsApp. They open it on their phone, select their site, write notes, and upload photos — no login needed.
      </p>

      {uploadUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', fontSize: 13, wordBreak: 'break-all', border: '1.5px solid var(--border)' }}>
            {uploadUrl}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={handleCopy} style={{ flex: 1 }}>
              <Copy size={14} /> {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button variant="secondary" onClick={handleGenerate} loading={generating} title="Regenerate link — old one stops working">
              <RefreshCw size={14} />
            </Button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            ⚠️ Regenerating creates a new link — the old one will stop working immediately.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <Button onClick={handleGenerate} loading={generating}>
            <Link2 size={14} /> Generate Upload Link
          </Button>
        </div>
      )}
    </Card>
  );
}