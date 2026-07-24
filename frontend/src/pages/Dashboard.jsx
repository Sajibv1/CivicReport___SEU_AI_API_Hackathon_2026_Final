import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, clearSessionToken, dashboardSocketUrl, getSessionToken, setSessionToken } from '../api/client.js';
import { useLang } from '../context/LangContext.jsx';
import MapView from '../components/MapView.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatBangladeshDateTime } from '../i18n/time.js';

const SEV_COLOR = {
  Critical: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  High:     'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  Medium:   'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  Low:      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};
const CATEGORIES = ['Pothole', 'Broken Streetlight', 'Water Leak', 'Illegal Dumping', 'Other'];
const SEVERITIES  = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES    = ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];

export default function Dashboard() {
  const { lang, t } = useLang();
  const [authed, setAuthed]       = useState(!!getSessionToken());
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [filters, setFilters]     = useState({ q: '', category: '', severity: '', status: '' });
  const [rows, setRows]           = useState([]);
  const [stats, setStats]         = useState(null);
  const [view, setView]           = useState('table');
  const [toast, setToast]         = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const wsRef = useRef(null);

  const load = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const [list, an] = await Promise.all([api.listReports({ ...params, page_size: 100 }), api.analytics()]);
      setRows(list.items); setStats(an);
    } catch (e) {
      setError(e.message);
      if (e.message.toLowerCase().includes('authentication')) { clearSessionToken(); setAuthed(false); }
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  useEffect(() => {
    if (!authed) return;
    const ws = new WebSocket(dashboardSocketUrl());
    ws.onmessage = (msg) => {
      const { event } = JSON.parse(msg.data);
      setToast(event === 'report.created' ? t('toast_new') : t('toast_updated'));
      setTimeout(() => setToast(''), 3000);
      load();
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [authed, load, t]);

  async function login(e) {
    e.preventDefault(); setError(''); setLoginBusy(true);
    try {
      const session = await api.login(username, password);
      setSessionToken(session.access_token); setPassword(''); setAuthed(true);
    } catch (err) { setError(err.message); }
    finally { setLoginBusy(false); }
  }

  if (!authed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <form className="card w-full max-w-sm p-8 space-y-4" onSubmit={login}>
          <div>
            <p className="eyebrow mb-1">{t('nav_admin')}</p>
            <h1>{t('dash_login_title')}</h1>
          </div>
          {error && <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">{error}</div>}
          <div>
            <label className="field-label" htmlFor="login-user">{t('dash_login_user_ph')}</label>
            <input id="login-user" className="field" autoComplete="username" placeholder={t('dash_login_user_ph')}
              value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <label className="field-label" htmlFor="login-pass">{t('dash_login_password_ph')}</label>
            <input id="login-pass" className="field" type="password" autoComplete="current-password" placeholder={t('dash_login_password_ph')}
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary w-full py-2.5" disabled={loginBusy}>
            {loginBusy ? t('dash_login_busy') : t('dash_login_btn')}
          </button>
        </form>
      </div>
    );
  }

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const tabCls = (v) => `btn btn-sm ${view === v ? 'btn-primary' : 'btn-ghost'}`;

  return (
    <div className="space-y-5">
      {toast && (
        <div role="status" aria-live="polite"
          className="fixed top-4 right-4 z-50 bg-civic-700 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <p className="eyebrow mb-0.5">{t('nav_admin')}</p>
          <h1>{t('dash_title')}</h1>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <Link to="/admin/visualizations" className="btn btn-ghost btn-sm">{t('nav_visualizations')}</Link>
          <button className="btn btn-ghost btn-sm" onClick={() => { clearSessionToken(); setAuthed(false); }}>{t('dash_logout')}</button>
          <button className={tabCls('table')} onClick={() => setView('table')}>{t('dash_view_table')}</button>
          <button className={tabCls('map')} onClick={() => setView('map')}>{t('dash_view_map')}</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">{error}</div>}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={t('stat_total')}       value={stats.total} />
          <Stat label={t('stat_in_progress')} value={stats.by_status['In Progress'] || 0} accent />
          <Stat label={t('stat_resolved')}    value={stats.by_status.Resolved || 0} green />
          <Stat label={t('stat_duplicates')}  value={stats.duplicates_flagged} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input className="field flex-1 min-w-40" placeholder={t('filter_search_ph')}
          value={filters.q} onChange={set('q')} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <select className="field w-auto" value={filters.category} onChange={set('category')}>
          <option value="">{t('filter_all_categories')}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat_${c}`)}</option>)}
        </select>
        <select className="field w-auto" value={filters.severity} onChange={set('severity')}>
          <option value="">{t('filter_all_severities')}</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="field w-auto" value={filters.status} onChange={set('status')}>
          <option value="">{t('filter_active_statuses')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`st_${s}`)}</option>)}
        </select>
        <button onClick={load} className="btn btn-primary">{t('filter_apply')}</button>
      </div>

      {loading && <div role="status" className="card p-4 text-sm text-slate-500">{t('loading')}</div>}

      {!loading && view === 'map' ? (
        <MapView reports={rows} />
      ) : !loading && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-left">
              <tr>
                <th className="p-3 font-medium text-slate-600">{t('col_code')}</th>
                <th className="p-3 font-medium text-slate-600">{t('col_uid')}</th>
                <th className="p-3 font-medium text-slate-600">{t('col_category')}</th>
                <th className="p-3 font-medium text-slate-600">{t('col_severity')}</th>
                <th className="p-3 font-medium text-slate-600">{t('col_status')}</th>
                <th className="p-3 font-medium text-slate-600">{t('col_reported_at')}</th>
                <th className="p-3 font-medium text-slate-600">{t('col_dept')}</th>
                <th className="p-3 font-medium text-slate-600">{t('col_flags')}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono text-sm font-medium text-slate-800">{r.tracking_code}</td>
                  <td className="p-3 font-mono text-xs text-slate-400">{r.report_uid}</td>
                  <td className="p-3 text-slate-700">{t(`cat_${r.category_ai}`)}</td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${SEV_COLOR[r.severity_level] || ''}`}>
                      {r.severity_level}{r.severity_score ? ` (${r.severity_score})` : ''}
                    </span>
                  </td>
                  <td className="p-3"><StatusBadge status={r.status} /></td>
                  <td className="p-3 whitespace-nowrap text-xs text-slate-400 font-mono">{formatBangladeshDateTime(r.created_at, lang)}</td>
                  <td className="p-3 text-slate-600">{r.department?.name || '—'}</td>
                  <td className="p-3">
                    {r.is_duplicate_of && <Link className="text-amber-600 text-xs underline" to={`/admin/reports/${r.is_duplicate_of}`}>DUP→#{r.is_duplicate_of}</Link>}
                    {r.ai_status === 'failed' && <span className="text-rose-500 text-xs ml-1">AI pending</span>}
                  </td>
                  <td className="p-3">
                    <Link className="text-civic-700 text-sm font-medium hover:underline" to={`/admin/reports/${r.id}`}>{t('col_manage')}</Link>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan="9" className="p-8 text-center text-slate-400">{t('empty_reports')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent, green }) {
  const valCls = accent ? 'text-amber-600' : green ? 'text-emerald-600' : 'text-slate-900';
  return (
    <div className="card p-4">
      <div className={`text-2xl font-bold font-mono ${valCls}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
