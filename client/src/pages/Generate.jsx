import { useState, useEffect, useRef } from 'react';
import { Zap, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Card, Button, Select, Badge, Spinner, StatusBar } from '../components/UI';
import styles from './Generate.module.css';

export default function Generate() {
  const [sites,    setSites]    = useState([]);
  const [site,     setSite]     = useState('');
  const [contents, setContents] = useState(null);   // { dateFolders, reportFiles }
  const [selected, setSelected] = useState([]);     // selected date folder names
  const [reportFileId,       setReportFileId]       = useState('');
  const [reportFileMimeType, setReportFileMimeType] = useState('');
  const [maxPhotos, setMaxPhotos] = useState(4);
  const [step,     setStep]     = useState('idle'); // idle | loading_dates | generating | done | error
  const [logs,     setLogs]     = useState([]);
  const [result,   setResult]   = useState(null);   // { docxUrl, reportIds, entriesCount }
  const logsRef = useRef(null);

  useEffect(() => {
    api.get('/sites')
      .then(r => setSites(r.data?.data?.sites ?? r.data?.sites ?? []))
      .catch(() => { toast.error('Failed to load sites.'); setSites([]); });
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  const handleSiteChange = async (e) => {
    const siteObj = sites.find(s => s._id === e.target.value);
    setSite(e.target.value);
    setContents(null);
    setSelected([]);
    setReportFileId('');
    if (!siteObj || !siteObj.driveFolderId) return;

    setStep('loading_dates');
    try {
      const res = await api.get(`/drive/sites/${siteObj.driveFolderId}/contents`);
      setContents(res.data);
      // Auto-select the first report file
      if (res.data.reportFiles?.length > 0) {
        setReportFileId(res.data.reportFiles[0].id);
        setReportFileMimeType(res.data.reportFiles[0].mimeType);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load Drive contents. Is Drive connected?');
    } finally {
      setStep('idle');
    }
  };

  const toggleDate = (name) => {
    setSelected(prev =>
      prev.includes(name)
        ? prev.filter(d => d !== name)
        : prev.length >= 7 ? (toast.error('Maximum 7 dates at a time.'), prev) : [...prev, name]
    );
  };

  const canGenerate = site && reportFileId && selected.length > 0 && step === 'idle';

  const handleGenerate = async () => {
    setStep('generating');
    setLogs([]);
    setResult(null);

    const siteObj = sites.find(s => s._id === site);

    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('riq_token')}`,
        },
        body: JSON.stringify({
          siteId: site,
          reportFileId,
          reportFileMimeType,
          selectedDates: selected,
          maxPhotos,
        }),
      });

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const json = JSON.parse(line.replace('data: ', ''));
          if (json.message === 'done') {
            setResult(json);
            setStep('done');
          } else if (json.message === 'error') {
            setLogs(l => [...l, `❌ ${json.error}`]);
            setStep('error');
          } else {
            setLogs(l => [...l, json.message]);
          }
        }
      }
    } catch (err) {
      setLogs(l => [...l, `❌ ${err.message}`]);
      setStep('error');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Generate Report Entries</h1>
        <p className={styles.sub}>Select a site, choose dates, and let AI write the reports</p>
      </div>

      <div className={styles.layout}>
        {/* Left — config panel */}
        <Card className={styles.configCard}>
          <h2 className={styles.sectionTitle}><span className={styles.stepNum}>1</span> Site & Report File</h2>

          <Select label="Site" value={site} onChange={handleSiteChange}>
            <option value="">— Select a site —</option>
            {sites.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </Select>

          {step === 'loading_dates' && <div className={styles.loadingDates}><Spinner /> Loading Drive contents...</div>}

          {contents && (
            <>
              <Select
                label="Raw Report File"
                value={reportFileId}
                onChange={e => {
                  const f = contents.reportFiles.find(f => f.id === e.target.value);
                  setReportFileId(e.target.value);
                  setReportFileMimeType(f?.mimeType || '');
                }}
              >
                {contents.reportFiles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>

              <div className={styles.dateSection}>
                <label className={styles.dateLabel}>
                  Select Dates <span className={styles.dateCount}>{selected.length}/7 selected</span>
                </label>
                <div className={styles.dateGrid}>
                  {contents.dateFolders.map(f => (
                    <button
                      key={f.id}
                      className={`${styles.dateChip} ${selected.includes(f.name) ? styles.dateChipActive : ''}`}
                      onClick={() => toggleDate(f.name)}
                      type="button"
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
                {contents.dateFolders.length === 0 && (
                  <p className={styles.noFolders}>No date folders found in this site's Drive folder.</p>
                )}
              </div>

              <div className={styles.photosRow}>
                <label className={styles.dateLabel}>Max Photos Per Day</label>
                <div className={styles.photoBtns}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      className={`${styles.photoBtn} ${maxPhotos === n ? styles.photoBtnActive : ''}`}
                      onClick={() => setMaxPhotos(n)}
                      type="button"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {!contents && !site && (
            <p className={styles.hint}>Select a site to see available dates from Google Drive.</p>
          )}

          {site && !contents && step !== 'loading_dates' && (
            <StatusBar type="warning">This site has no Drive folder linked. Edit the site to add one.</StatusBar>
          )}

          <Button
            variant="gold"
            className={styles.generateBtn}
            disabled={!canGenerate}
            loading={step === 'generating'}
            onClick={handleGenerate}
          >
            <Zap size={16} /> Generate {selected.length > 0 ? `${selected.length} ${selected.length === 1 ? 'Entry' : 'Entries'}` : 'Entries'}
          </Button>
        </Card>

        {/* Right — progress + result */}
        <div className={styles.outputCol}>
          {/* Progress log */}
          {(step === 'generating' || step === 'done' || step === 'error') && (
            <Card className={styles.logCard}>
              <h2 className={styles.sectionTitle}>Progress</h2>
              <div className={styles.logBox} ref={logsRef}>
                {logs.map((l, i) => <p key={i} className={styles.logLine}>› {l}</p>)}
                {step === 'generating' && <p className={styles.logLine}>› <Spinner size="sm" /></p>}
              </div>
            </Card>
          )}

          {/* Result */}
          {step === 'done' && result && (
            <Card className={styles.resultCard}>
              <div className={styles.resultHeader}>
                <CheckCircle size={20} className={styles.resultIcon} />
                <h2 className={styles.sectionTitle}>Done! {result.entriesCount} {result.entriesCount === 1 ? 'entry' : 'entries'} generated</h2>
              </div>
              <p className={styles.resultSub}>Reports saved to your account. Download the DOCX or view in Reports.</p>
              <div className={styles.resultActions}>
                <a href={result.docxUrl} target="_blank" rel="noreferrer">
                  <Button variant="primary">⬇ Download DOCX</Button>
                </a>
                <a href="/reports">
                  <Button variant="secondary">View Reports</Button>
                </a>
              </div>
              {result.tokenUsage && (
                <p className={styles.tokenInfo}>
                  AI tokens used: {result.tokenUsage.input + result.tokenUsage.output} ({result.tokenUsage.input} in / {result.tokenUsage.output} out)
                </p>
              )}
            </Card>
          )}

          {step === 'error' && (
            <StatusBar type="error">
              <AlertCircle size={15} /> Generation failed. Check the log above and try again.
            </StatusBar>
          )}
        </div>
      </div>
    </div>
  );
}