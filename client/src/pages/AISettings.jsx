import { useState, useEffect } from 'react';
import { Zap, Save, Trash2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Button, Select, Card, StatusBar } from '../components/UI';
import styles from './AISettings.module.css';

export default function AISettings() {
  const [config,    setConfig]   = useState(null);
  const [loading,   setLoading]  = useState(true);
  const [saving,    setSaving]   = useState(false);
  const [testing,   setTesting]  = useState(null); // provider id being tested
  const [keyInputs, setKeyInputs] = useState({}); // { claude: '', gemini: '', ... }
  const [testResults, setTestResults] = useState({}); // { claude: { ok, msg } }

  const load = () => {
    setLoading(true);
    api.get('/settings/ai')
      .then(r => {
        const d = r.data.data ?? r.data;
        setConfig(d);
        // Init key inputs as empty — user types new key to replace
        const inputs = {};
        d.providers?.forEach(p => { inputs[p.id] = ''; });
        setKeyInputs(inputs);
      })
      .catch(() => toast.error('Failed to load AI settings.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleProviderChange = async (provider) => {
    const p = config.providers.find(x => x.id === provider);
    if (!p) return;
    try {
      await api.patch('/settings/ai', { provider, model: p.defaultModel });
      setConfig(c => ({ ...c, provider, model: p.defaultModel }));
      toast.success(`Switched to ${p.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to switch provider.');
    }
  };

  const handleModelChange = async (model) => {
    try {
      await api.patch('/settings/ai', { model });
      setConfig(c => ({ ...c, model }));
    } catch (err) {
      toast.error('Failed to update model.');
    }
  };

  const handleSaveKey = async (providerId) => {
    const key = keyInputs[providerId]?.trim();
    if (!key) return toast.error('Please enter an API key.');
    setSaving(providerId);
    try {
      await api.post('/settings/ai/key', { provider: providerId, apiKey: key });
      toast.success('API key saved.');
      setKeyInputs(k => ({ ...k, [providerId]: '' }));
      setConfig(c => ({ ...c, keys: { ...c.keys, [providerId]: '••••••••' } }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save key.');
    } finally {
      setSaving(null);
    }
  };

  const handleRemoveKey = async (providerId) => {
    if (!window.confirm('Remove this API key?')) return;
    try {
      await api.delete('/settings/ai/key', { data: { provider: providerId } });
      toast.success('API key removed.');
      setConfig(c => ({ ...c, keys: { ...c.keys, [providerId]: null } }));
    } catch (err) {
      toast.error('Failed to remove key.');
    }
  };

  const handleTest = async (providerId) => {
    setTesting(providerId);
    setTestResults(r => ({ ...r, [providerId]: null }));
    try {
      const model = config.provider === providerId ? config.model : null;
      const res   = await api.post('/settings/ai/test', { provider: providerId, model });
      setTestResults(r => ({ ...r, [providerId]: { ok: true, msg: res.data.message } }));
    } catch (err) {
      setTestResults(r => ({ ...r, [providerId]: { ok: false, msg: err.response?.data?.message || 'Connection failed.' } }));
    } finally {
      setTesting(null);
    }
  };

  if (loading) return <div style={{ padding: 24, color: '#6b7280' }}>Loading AI settings...</div>;
  if (!config) return null;

  const activeProvider = config.providers?.find(p => p.id === config.provider);
  const activeModels   = activeProvider?.models || [];

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>AI Provider</h2>
      <p className={styles.sub}>
        Switch between AI providers at any time. Your reports will use whichever provider is active.
        {!activeProvider?.supportsVision && (
          <span className={styles.visionWarning}> ⚠️ Current provider does not support photo analysis.</span>
        )}
      </p>

      {/* Active provider selector */}
      <div className={styles.activeRow}>
        <Select
          label="Active Provider"
          value={config.provider}
          onChange={e => handleProviderChange(e.target.value)}
        >
          {config.providers?.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} {config.keys?.[p.id] ? '✓' : '(no key)'}
            </option>
          ))}
        </Select>

        <Select
          label="Model"
          value={config.model}
          onChange={e => handleModelChange(e.target.value)}
        >
          {activeModels.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </Select>
      </div>

      {/* Provider cards */}
      <div className={styles.providerList}>
        {config.providers?.map(p => {
          const hasKey    = !!config.keys?.[p.id];
          const isActive  = config.provider === p.id;
          const testRes   = testResults[p.id];

          return (
            <div key={p.id} className={`${styles.providerCard} ${isActive ? styles.providerActive : ''}`}>
              <div className={styles.providerHeader}>
                <div>
                  <div className={styles.providerName}>
                    {p.name}
                    {isActive && <span className={styles.activeBadge}>ACTIVE</span>}
                  </div>
                  <div className={styles.providerDesc}>{p.description}</div>
                  <div className={styles.providerHint}>{p.keyHint}</div>
                </div>
                <div className={styles.visionBadge}>
                  {p.supportsVision ? '📷 Vision' : '📝 Text only'}
                </div>
              </div>

              {/* Key input */}
              <div className={styles.keyRow}>
                <input
                  className={styles.keyInput}
                  type="password"
                  placeholder={hasKey ? '••••••••  (paste to replace)' : `Paste your ${p.keyLabel}`}
                  value={keyInputs[p.id] || ''}
                  onChange={e => setKeyInputs(k => ({ ...k, [p.id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  loading={saving === p.id}
                  onClick={() => handleSaveKey(p.id)}
                  disabled={!keyInputs[p.id]?.trim()}
                >
                  <Save size={13} /> Save
                </Button>
                {hasKey && (
                  <>
                    <Button size="sm" variant="secondary"
                      loading={testing === p.id}
                      onClick={() => handleTest(p.id)}>
                      <RefreshCw size={13} /> Test
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleRemoveKey(p.id)}>
                      <Trash2 size={13} />
                    </Button>
                  </>
                )}
              </div>

              {/* Test result */}
              {testRes && (
                <div className={`${styles.testResult} ${testRes.ok ? styles.testOk : styles.testFail}`}>
                  {testRes.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                  {testRes.msg}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}