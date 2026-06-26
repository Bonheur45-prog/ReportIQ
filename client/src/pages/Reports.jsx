import { useState, useEffect } from 'react';
import { FileText, Download, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Card, Button, Select, Badge, Empty, Spinner } from '../components/UI';
import styles from './Reports.module.css';

const STATUS_COLORS = { generated: 'default', reviewed: 'info', approved: 'success' };

export default function Reports() {
  const [reports,  setReports]  = useState([]);
  const [sites,    setSites]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filters,  setFilters]  = useState({ siteId: '', status: '' });
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);
  const [viewing,  setViewing]  = useState(null);
  const [deleting, setDeleting] = useState(null);
  const LIMIT = 15;

  useEffect(() => {
    api.get('/sites').then(r => setSites(r.data?.data?.sites ?? r.data?.sites ?? [])).catch(() => setSites([]));
  }, []);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (filters.siteId)  params.append('siteId',  filters.siteId);
    if (filters.status)  params.append('status',  filters.status);
    api.get(`/reports?${params}`)
      .then(r => {
        const responseData = r.data.data ?? r.data;
        setReports(responseData.reports || []);
        setTotal(responseData.total || 0);
        setPages(responseData.pages || 1);
      })
      .catch(() => { toast.error('Failed to load reports.'); setReports([]); })
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, filters]);

  const handleFilterChange = e => {
    setFilters(f => ({ ...f, [e.target.name]: e.target.value }));
    setPage(1);
  };

  const handleDelete = async (report) => {
    if (!window.confirm(`Delete report for ${report.date}? This cannot be undone.`)) return;
    setDeleting(report._id);
    try {
      await api.delete(`/reports/${report._id}`);
      toast.success('Report deleted.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  };

  const handleStatusChange = async (report, status) => {
    try {
      await api.patch(`/reports/${report._id}/status`, { status });
      setReports(rs => rs.map(r => r._id === report._id ? { ...r, status } : r));
      toast.success('Status updated.');
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reports</h1>
          <p className={styles.sub}>{total} report{total !== 1 ? 's' : ''} total</p>
        </div>
      </div>

      {/* Filters */}
      <Card className={styles.filterCard}>
        <div className={styles.filters}>
          <Select name="siteId" value={filters.siteId} onChange={handleFilterChange}>
            <option value="">All sites</option>
            {sites.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </Select>
          <Select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">All statuses</option>
            <option value="generated">Generated</option>
            <option value="reviewed">Reviewed</option>
            <option value="approved">Approved</option>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className={styles.tableCard}>
        {loading ? (
          <div className={styles.center}><Spinner size="lg" /></div>
        ) : reports.length === 0 ? (
          <Empty
            icon={<FileText />}
            title="No reports found"
            description="Generate your first report from the Generate page."
          />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Date</th>
                  <th>Photos</th>
                  <th>Status</th>
                  <th>Generated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r._id}>
                    <td className={styles.siteName}>{r.site?.name}</td>
                    <td className={styles.date}>{r.date}</td>
                    <td>{r.photos?.length ?? 0}</td>
                    <td>
                      <select
                        className={styles.statusSelect}
                        value={r.status}
                        onChange={e => handleStatusChange(r, e.target.value)}
                      >
                        <option value="generated">Generated</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="approved">Approved</option>
                      </select>
                    </td>
                    <td className={styles.dateSmall}>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.iconBtn} title="View" onClick={() => setViewing(r._id)}>
                          <Eye size={15} />
                        </button>
                        {r.docxUrl && (
                          <a href={r.docxUrl} target="_blank" rel="noreferrer">
                            <button className={styles.iconBtn} title="Download DOCX">
                              <Download size={15} />
                            </button>
                          </a>
                        )}
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          title="Delete"
                          onClick={() => handleDelete(r)}
                          disabled={deleting === r._id}
                        >
                          {deleting === r._id ? <Spinner size="sm" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pages > 1 && (
              <div className={styles.pagination}>
                <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
                <span className={styles.pageInfo}>Page {page} of {pages}</span>
                <Button variant="secondary" size="sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* View modal */}
      {viewing && <ReportViewModal reportId={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

// ── Report view modal ─────────────────────────────────────────────────────────
function ReportViewModal({ reportId, onClose }) {
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/reports/${reportId}`)
      .then(r => setReport(r.data.data?.report ?? r.data.report))
      .catch(() => toast.error('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [reportId]);

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>{report?.site?.name}</h2>
            <p className={styles.modalSub}>{report?.date}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className={styles.center}><Spinner size="lg" /></div>
        ) : (
          <div className={styles.modalBody}>
            <div className={styles.generatedText}>
              {report?.generatedText?.split('\n').map((line, i) => (
                <p key={i} className={line.startsWith('**') ? styles.boldLine : ''}>{line}</p>
              ))}
            </div>

            {report?.photos?.length > 0 && (
              <div className={styles.photoGrid}>
                {report.photos.map((p, i) => (
                  <img key={i} src={p.url} alt={`Image ${i + 1}`} className={styles.photo} />
                ))}
              </div>
            )}

            {report?.docxUrl && (
              <a href={report.docxUrl} target="_blank" rel="noreferrer">
                <Button className={styles.downloadBtn}><Download size={15} /> Download DOCX</Button>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}