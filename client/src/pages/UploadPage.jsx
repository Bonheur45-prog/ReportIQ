import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, FileText, Send, CheckCircle, AlertCircle, X, MapPin, Clock, History } from 'lucide-react';
import { compressImage } from '../utils/imageCompressor';
import styles from './UploadPage.module.css';

// ── Translations ───────────────────────────────────────────────────────────────
const T = {
  en: {
    selectSite:'Select Site', chooseSite:'— Choose your site —',
    dateOfWork:'Date of Work', whatDone:'What was done today?',
    notesPlaceholder:'Describe the work done today. You can write in Kinyarwanda, French, or English...',
    notesHint:'Be specific — what was installed, where, and how much.',
    photos:'Site Photos', addPhotos:'Add Photos', addMore:'Add More Photos',
    photosHint:'Take photos with your camera or choose from gallery.',
    submit:'Submit Report', uploading:'Uploading...',
    yourName:'Your Name', namePlaceholder:'e.g. Jean Pierre',
    nameHint:'Your name will appear in the report.',
    submitted:'Report Submitted!', submitAnother:'Submit Another Report',
    linkInvalid:'Link not valid', loading:'Loading...',
    offline:'⚠️ No internet connection — your draft is saved',
    draft:'You have an unsaved draft', continueDraft:'Continue', discardDraft:'Discard',
    noPhotosWarning:'You haven\'t added any photos. Site reports without photos are harder to use.',
    submitAnyway:'Submit Without Photos', addPhotosFirst:'Add Photos First',
    alreadySubmitted:'Report already submitted. Please wait before submitting again.',
    recentSubmissions:'Recent Submissions', preparing:'Preparing photos...',
  },
  fr: {
    selectSite:'Sélectionner le site', chooseSite:'— Choisissez votre site —',
    dateOfWork:'Date des travaux', whatDone:'Qu\'est-ce qui a été fait aujourd\'hui ?',
    notesPlaceholder:'Décrivez les travaux. Vous pouvez écrire en Kinyarwanda, français ou anglais...',
    notesHint:'Soyez précis — ce qui a été installé, où et combien.',
    photos:'Photos du chantier', addPhotos:'Ajouter des photos', addMore:'Ajouter plus de photos',
    photosHint:'Prenez des photos avec votre appareil ou choisissez depuis la galerie.',
    submit:'Soumettre le rapport', uploading:'Envoi en cours...',
    yourName:'Votre nom', namePlaceholder:'ex. Jean Pierre',
    nameHint:'Votre nom apparaîtra dans le rapport.',
    submitted:'Rapport soumis !', submitAnother:'Soumettre un autre rapport',
    linkInvalid:'Lien invalide', loading:'Chargement...',
    offline:'⚠️ Pas de connexion internet — votre brouillon est sauvegardé',
    draft:'Vous avez un brouillon non envoyé', continueDraft:'Continuer', discardDraft:'Supprimer',
    noPhotosWarning:'Vous n\'avez pas ajouté de photos. Les rapports sans photos sont plus difficiles à utiliser.',
    submitAnyway:'Soumettre sans photos', addPhotosFirst:'Ajouter des photos d\'abord',
    alreadySubmitted:'Rapport déjà soumis. Veuillez attendre avant de soumettre à nouveau.',
    recentSubmissions:'Soumissions récentes', preparing:'Préparation des photos...',
  },
  rw: {
    selectSite:'Hitamo ahantu', chooseSite:'— Hitamo site yawe —',
    dateOfWork:'Italiki y\'akazi', whatDone:'Ni iki cyakozwe uyu munsi?',
    notesPlaceholder:'Sobanura akazi kakozwe. Ushobora kwandika mu Kinyarwanda, Igifaransa cyangwa Icyongereza...',
    notesHint:'Sobanura neza — iki cyashyizweho, hehe, n\'ingahe.',
    photos:'Amafoto y\'ahantu', addPhotos:'Ongeraho amafoto', addMore:'Ongeraho amafoto menshi',
    photosHint:'Fata amafoto ukoresheje kamera cyangwa uhitemo muri galeri.',
    submit:'Ohereza raporo', uploading:'Kohereza...',
    yourName:'Amazina yawe', namePlaceholder:'urugero: Jean Pierre',
    nameHint:'Amazina yawe azagaragara muri raporo.',
    submitted:'Raporo yoherejwe!', submitAnother:'Ohereza indi raporo',
    linkInvalid:'Umunyururu ntabwo ukwiye', loading:'Gutegereza...',
    offline:'⚠️ Nta internet — amakuru yawe abitswe',
    draft:'Ufite raporo itarashyikirizwa', continueDraft:'Komeza', discardDraft:'Siba',
    noPhotosWarning:'Ntabwo wongereye amafoto. Raporo zidafite amafoto bigorana.',
    submitAnyway:'Ohereza nta mafoto', addPhotosFirst:'Banza wongerehe amafoto',
    alreadySubmitted:'Raporo yoherejwe. Tegereza mbere yo kohereza indi.',
    recentSubmissions:'Raporo zoherejwe vuba', preparing:'Gutegura amafoto...',
  },
};

const DRAFT_KEY = (t) => `riq_draft_${t}`;
const HIST_KEY  = (t) => `riq_history_${t}`;
const LANG_KEY  = 'riq_lang';
const NAME_KEY  = 'riq_worker_name';
const DEDUP_KEY = (t) => `riq_last_submit_${t}`;

export default function UploadPage() {
  const { token } = useParams();

  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) || 'en');
  const tr = T[lang] || T.en;
  const switchLang = (l) => { setLang(l); localStorage.setItem(LANG_KEY, l); };

  const [info,        setInfo]       = useState(null);
  const [error,       setError]      = useState(null);
  const [loading,     setLoading]    = useState(true);
  const [submitting,  setSubmitting] = useState(false);
  const [submitted,   setSubmitted]  = useState(false);
  const [submitMsg,   setSubmitMsg]  = useState('');
  const [isOnline,    setIsOnline]   = useState(navigator.onLine);
  const [showDraft,   setShowDraft]  = useState(false);
  const [showNoDlg,   setShowNoDlg]  = useState(false);
  const [preparing,   setPreparing]  = useState(false);
  const [progress,    setProgress]   = useState(0);
  const [history,     setHistory]    = useState([]);

  const today = new Date().toISOString().split('T')[0];
  const [workerName, setWorkerName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [siteId,     setSiteId]     = useState('');
  const [siteName,   setSiteName]   = useState('');
  const [date,       setDate]       = useState(today);
  const [notes,      setNotes]      = useState('');
  const [photos,     setPhotos]     = useState([]); // { file, preview, compressing }
  const fileRef = useRef(null);

  // Load site info
  useEffect(() => {
    fetch(`/api/upload/${token}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) setError(data.message);
        else { const d = data.data ?? data; setInfo({ companyName: d.companyName, sites: d.sites || [] }); }
      })
      .catch(() => setError('Could not load page. Check your internet connection.'))
      .finally(() => setLoading(false));
  }, [token]);

  // Load history
  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(HIST_KEY(token)) || '[]')); } catch {}
  }, [token]);

  // Online/offline
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Check for draft on mount
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY(token)));
      if (d && (d.notes || d.siteId)) setShowDraft(true);
    } catch {}
  }, [token]);

  const loadDraft = () => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY(token)));
      if (!d) return;
      if (d.siteId) setSiteId(d.siteId);
      if (d.date)   setDate(d.date);
      if (d.notes)  setNotes(d.notes);
    } catch {}
    setShowDraft(false);
  };

  const discardDraft = () => { localStorage.removeItem(DRAFT_KEY(token)); setShowDraft(false); };

  // Save draft on every change
  useEffect(() => {
    if (!siteId && !notes) return;
    localStorage.setItem(DRAFT_KEY(token), JSON.stringify({ siteId, date, notes }));
  }, [siteId, date, notes, token]);

  // WhatsApp-style photo selection
  const handlePhotoSelect = async (e) => {
    const rawFiles = Array.from(e.target.files);
    e.target.value = '';
    if (!rawFiles.length) return;
    setPreparing(true);

    // Add slots immediately with raw preview + compressing flag
    setPhotos(prev => {
      const slots = rawFiles.map(file => ({ file, preview: URL.createObjectURL(file), compressing: true }));
      return [...prev, ...slots].slice(0, 10);
    });

    // Compress each and swap when done
    rawFiles.forEach(rawFile => {
      compressImage(rawFile).then(compressed => {
        const compressedPreview = URL.createObjectURL(compressed);
        setPhotos(prev => {
          const idx = prev.findIndex(p => p.compressing && p.file === rawFile);
          if (idx === -1) return prev;
          URL.revokeObjectURL(prev[idx].preview);
          const next = [...prev];
          next[idx] = { file: compressed, preview: compressedPreview, compressing: false };
          return next;
        });
      });
    });

    setPreparing(false);
  };

  const removePhoto = (index) => {
    setPhotos(prev => { URL.revokeObjectURL(prev[index].preview); return prev.filter((_, i) => i !== index); });
  };

  const doSubmit = async () => {
    // Double-submission guard — 60 second window
    const last = parseInt(localStorage.getItem(DEDUP_KEY(token)) || '0');
    if (Date.now() - last < 60000) return alert(tr.alreadySubmitted);

    setSubmitting(true);
    setProgress(10);

    const now       = new Date();
    const timeStr   = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const dateStr   = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timestamp = `${dateStr} at ${timeStr}`;

    const fullNotes = [
      notes.trim(),
      workerName.trim() ? `Reported by: ${workerName.trim()}` : null,
      `Submitted: ${timestamp}`,
    ].filter(Boolean).join('\n');

    try {
      setProgress(30);
      const formData = new FormData();
      formData.append('siteId', siteId);
      formData.append('date',   date);
      formData.append('notes',  fullNotes);
      photos.forEach(p => formData.append('photos', p.file));

      const interval = setInterval(() => setProgress(p => p < 85 ? p + 3 : p), 300);
      const res      = await fetch(`/api/upload/${token}`, { method: 'POST', body: formData });
      clearInterval(interval);
      setProgress(95);

      const data = await res.json();
      if (data.success) {
        setProgress(100);
        localStorage.setItem(DEDUP_KEY(token), String(Date.now()));
        localStorage.removeItem(DRAFT_KEY(token));
        const entry     = { siteName, date, photos: photos.length, time: timestamp };
        const newHist   = [entry, ...history].slice(0, 3);
        setHistory(newHist);
        localStorage.setItem(HIST_KEY(token), JSON.stringify(newHist));
        photos.forEach(p => URL.revokeObjectURL(p.preview));
        setSubmitMsg(data.message);
        setSubmitted(true);
      } else if (data.code === 'DRIVE_TOKEN_EXPIRED') {
        alert('⚠️ ' + data.message);
      } else {
        alert(data.message || 'Submission failed. Please try again.');
      }
    } catch {
      alert('Connection error. Please check your internet and try again.');
    } finally {
      setSubmitting(false);
      setProgress(0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!siteId)        return alert(tr.chooseSite);
    if (!notes.trim())  return alert(tr.notesPlaceholder);
    if (!isOnline)      return alert(tr.offline);
    if (photos.length === 0) { setShowNoDlg(true); return; }
    await doSubmit();
  };

  const handleReset = () => {
    setSubmitted(false); setNotes(''); setPhotos([]);
    setDate(today); setSiteId(''); setSiteName(''); setProgress(0);
  };

  if (loading) return <div className={styles.centered}><div className={styles.spinner} /><p>{tr.loading}</p></div>;

  if (error) return (
    <div className={styles.centered}>
      <AlertCircle size={40} className={styles.errorIcon} />
      <h2>{tr.linkInvalid}</h2><p>{error}</p>
    </div>
  );

  if (submitted) return (
    <div className={styles.centered}>
      <CheckCircle size={56} className={styles.successIcon} />
      <h2>{tr.submitted}</h2>
      <p className={styles.successMsg}>{submitMsg}</p>
      {history.length > 0 && (
        <div className={styles.historyBox}>
          <div className={styles.historyTitle}><History size={14} /> {tr.recentSubmissions}</div>
          {history.map((h, i) => (
            <div key={i} className={styles.historyItem}>
              <div className={styles.histSite}>{h.siteName}</div>
              <div className={styles.histMeta}>{h.date} · {h.photos} photo{h.photos !== 1 ? 's' : ''} · {h.time}</div>
            </div>
          ))}
        </div>
      )}
      <button className={styles.btnPrimary} onClick={handleReset} style={{ marginTop: 20 }}>{tr.submitAnother}</button>
    </div>
  );

  if (showNoDlg) return (
    <div className={styles.centered}>
      <AlertCircle size={44} style={{ color: '#f59e0b' }} />
      <h2 style={{ fontSize: 18 }}>No Photos</h2>
      <p>{tr.noPhotosWarning}</p>
      <div style={{ display:'flex', gap:12, marginTop:16, flexWrap:'wrap', justifyContent:'center' }}>
        <button className={styles.btnSecondary} onClick={() => setShowNoDlg(false)}>{tr.addPhotosFirst}</button>
        <button className={styles.btnPrimary} onClick={() => { setShowNoDlg(false); doSubmit(); }}>{tr.submitAnyway}</button>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      {!isOnline && <div className={styles.offlineBanner}>{tr.offline}</div>}

      <div className={styles.header}>
        <div className={styles.logo}>⚡ ReportIQ</div>
        <div className={styles.companyName}>{info.companyName}</div>
        <div className={styles.langSwitcher}>
          {['en','fr','rw'].map(l => (
            <button key={l} type="button"
              className={`${styles.langBtn} ${lang === l ? styles.langActive : ''}`}
              onClick={() => switchLang(l)}>
              {l === 'en' ? 'EN' : l === 'fr' ? 'FR' : 'RW'}
            </button>
          ))}
        </div>
      </div>

      {showDraft && (
        <div className={styles.draftBanner}>
          <span>{tr.draft}</span>
          <div className={styles.draftActions}>
            <button onClick={loadDraft} className={styles.draftBtn}>{tr.continueDraft}</button>
            <button onClick={discardDraft} className={styles.draftBtnSec}>{tr.discardDraft}</button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>

        <div className={styles.field}>
          <label className={styles.label}>{tr.yourName}</label>
          <input className={styles.input} value={workerName}
            onChange={e => setWorkerName(e.target.value)}
            onBlur={() => localStorage.setItem(NAME_KEY, workerName.trim())}
            placeholder={tr.namePlaceholder}
            inputMode="text" enterKeyHint="next" />
          <span className={styles.hint}>{tr.nameHint}</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label}><MapPin size={16} /> {tr.selectSite}</label>
          <select className={styles.input} value={siteId}
            onChange={e => { setSiteId(e.target.value); setSiteName(e.target.options[e.target.selectedIndex].text); }} required>
            <option value="">{tr.chooseSite}</option>
            {info.sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}{s.location ? ` — ${s.location}` : ''}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}><Clock size={16} /> {tr.dateOfWork}</label>
          <input type="date" className={styles.input} value={date}
            onChange={e => setDate(e.target.value)} max={today} required />
        </div>

        <div className={styles.field}>
          <label className={styles.label}><FileText size={16} /> {tr.whatDone}</label>
          <textarea className={styles.textarea} value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={tr.notesPlaceholder}
            inputMode="text" enterKeyHint="done" rows={6} required />
          <span className={styles.hint}>{tr.notesHint}</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            <Camera size={16} /> {tr.photos} ({photos.length}/10)
            {preparing && <span className={styles.preparingTag}>{tr.preparing}</span>}
          </label>
          {photos.length > 0 && (
            <div className={styles.photoGrid}>
              {photos.map((p, i) => (
                <div key={i} className={`${styles.photoThumb} ${p.compressing ? styles.photoCompressing : ''}`}>
                  <img src={p.preview} alt={`Photo ${i + 1}`} />
                  {p.compressing
                    ? <div className={styles.photoOverlay}><div className={styles.spinnerSm} /></div>
                    : <button type="button" className={styles.removePhoto} onClick={() => removePhoto(i)}><X size={14} /></button>
                  }
                </div>
              ))}
            </div>
          )}
          <button type="button" className={styles.photoBtn}
            onClick={() => fileRef.current?.click()}
            disabled={photos.length >= 10 || preparing}>
            <Camera size={18} />
            {photos.length === 0 ? tr.addPhotos : tr.addMore}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple
            onChange={handlePhotoSelect} style={{ display: 'none' }} />
          <span className={styles.hint}>{tr.photosHint}</span>
        </div>

        {submitting && (
          <div className={styles.progressWrap}>
            <div className={styles.progressBar} style={{ width: `${progress}%` }} />
          </div>
        )}

        <button type="submit" className={styles.submitBtn}
          disabled={submitting || !notes.trim() || !siteId || !isOnline || photos.some(p => p.compressing)}>
          {submitting
            ? <><div className={styles.spinnerSm} /> {tr.uploading}</>
            : <><Send size={18} /> {tr.submit}</>}
        </button>
      </form>
    </div>
  );
}