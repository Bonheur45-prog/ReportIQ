import { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Card, Button, Input, Select, Badge, Empty, Spinner } from '../components/UI';
import styles from './Sites.module.css';

const STATUS_COLORS = { active: 'success', completed: 'info', on_hold: 'warning' };

export default function Sites() {
  const [sites,    setSites]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [modal,    setModal]   = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [tick,     setTick]    = useState(0); // increment to force reload

  const load = useCallback(() => {
    setLoading(true);
    api.get('/sites')
      .then(r => {
        setSites(r.data.sites || []);
      })
      .catch(() => { toast.error('Failed to load sites.'); setSites([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load, tick]);

  const handleDelete = async (site) => {
    if (!window.confirm(`Delete "${site.name}" and all its reports? This cannot be undone.`)) return;
    setDeleting(site._id);
    try {
      await api.delete(`/sites/${site._id}`);
      toast.success('Site deleted.');
      setTick(t => t + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Sites</h1>
          <p className={styles.sub}>{sites.length} site{sites.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Button variant="gold" onClick={() => setModal('create')}>
          <Plus size={16} /> Add Site
        </Button>
      </div>

      {sites.length === 0 ? (
        <Card>
          <Empty
            icon={<MapPin />}
            title="No sites yet"
            description="Add your first construction site to start generating reports."
            action={<Button onClick={() => setModal('create')}><Plus size={15}/> Add Site</Button>}
          />
        </Card>
      ) : (
        <div className={styles.grid}>
          {sites.map(site => (
            <Card key={site._id} className={styles.siteCard}>
              <div className={styles.siteTop}>
                <div className={styles.siteIcon}><MapPin size={18} /></div>
                <Badge variant={STATUS_COLORS[site.status]}>{site.status.replace('_', ' ')}</Badge>
              </div>
              <h3 className={styles.siteName}>{site.name}</h3>
              {site.location && <p className={styles.siteLoc}>{site.location}</p>}
              <div className={styles.siteMeta}>
                <span>{site.stats?.totalReports ?? 0} reports</span>
                {site.driveFolderId && <span className={styles.driveTag}><FolderOpen size={12}/> Drive linked</span>}
              </div>
              <div className={styles.siteActions}>
                <Button variant="secondary" size="sm" onClick={() => setModal(site)}>
                  <Pencil size={13}/> Edit
                </Button>
<Button variant="danger" size="sm" onClick={() => handleDelete(site)} loading={deleting === site._id}>
                  <Trash2 size={13}/> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <SiteModal
          site={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); setTick(t => t + 1); }}
        />
      )}

    </div>
  );
}

// ── Site create/edit modal ────────────────────────────────────────────────────
function SiteModal({ site, onClose, onSaved }) {
  const isEdit = !!site;
  const [form, setForm]       = useState({
    name:          site?.name          || '',
    location:      site?.location      || '',
    description:   site?.description   || '',
    driveFolderId: site?.driveFolderId || '',
    status:        site?.status        || 'active',
  });
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});

  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrors(er => ({ ...er, [e.target.name]: '' }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name.trim()) return setErrors({ name: 'Site name is required' });
    setLoading(true);
    try {
      if (isEdit) {
        await api.patch(`/sites/${site._id}`, form);
        toast.success('Site updated.');
      } else {
        await api.post('/sites', form);
        toast.success('Site created.');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <h2 className={styles.modalTitle}>{isEdit ? 'Edit Site' : 'Add New Site'}</h2>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <Input label="Site name *" name="name" value={form.name} onChange={handleChange} error={errors.name} placeholder="Madras Hotel & Apartments" autoFocus />
          <Input label="Location" name="location" value={form.location} onChange={handleChange} placeholder="Gisozi, Kigali" />
          <Input label="Google Drive Folder ID" name="driveFolderId" value={form.driveFolderId} onChange={handleChange} placeholder="1dPsMoA1PR0i9..." hint="Open the site folder in Drive → copy ID from the URL" />
          <Input label="Description" name="description" value={form.description} onChange={handleChange} placeholder="Brief project description" />
          {isEdit && (
            <Select label="Status" name="status" value={form.status} onChange={handleChange}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </Select>
          )}
          <div className={styles.modalActions}>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={loading}>{isEdit ? 'Save Changes' : 'Create Site'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}