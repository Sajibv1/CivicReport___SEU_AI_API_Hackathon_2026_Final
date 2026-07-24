import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useLang } from '../context/LangContext.jsx';
import { formatBangladeshDateTime } from '../i18n/time.js';

const STATUSES = ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];

export default function ReportDetail() {
  const { id } = useParams();
  const { lang, t } = useLang();
  const [data, setData] = useState(null);
  const [depts, setDepts] = useState([]);
  const [form, setForm] = useState({ status: '', department_id: '', note: '', is_public: true });
  const [originalReportId, setOriginalReportId] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await api.reportDetail(id);
    setData(d);
    setDepts(await api.departments());
    setForm((f) => ({ ...f, status: d.report.status, department_id: d.report.department_id || '' }));
    setOriginalReportId(d.report.is_duplicate_of || '');
  }, [id]);

  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [load]);

  async function save() {
    setBusy(true); setMsg('');
    try {
      await api.updateReport(id, { status: form.status, department_id: form.department_id ? Number(form.department_id) : null, note: form.note || null, is_public: form.is_public });
      setForm((f) => ({ ...f, note: '' }));
      setMsg(t('manage_saved'));
      await load();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  async function rerun() {
    setBusy(true); setMsg('');
    try { await api.reanalyze(id); setMsg('AI re-analysis complete ✓'); await load(); }
    catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  async function saveDuplicateLink() {
    setBusy(true); setMsg('');
    try {
      await api.updateDuplicateLink(id, { original_report_id: originalReportId ? Number(originalReportId) : null });
      setMsg(t('manage_duplicate_saved'));
      await load();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  if (!data) return <p className="text-slate-400 text-sm">{t('loading')}</p>;
  const r = data.report;

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <div>
          <Link to="/admin" className="text-sm text-civic-700 hover:underline">← {t('detail_back')}</Link>
          <div className="mt-2 flex items-baseline gap-3 flex-wrap">
            <h1 className="font-mono">{r.tracking_code}</h1>
            <span className="text-xs text-slate-400 font-mono">{r.report_uid}</span>
          </div>
        </div>

        {msg && <div className="rounded-lg bg-civic-50 border border-civic-200 text-civic-800 text-sm p-3">{msg}</div>}

        <div className="card p-5 space-y-2">
          <p className="eyebrow">{t('detail_citizen')}</p>
          <p className="text-sm text-slate-800">{r.description}</p>
          {r.address && <p className="text-xs text-slate-400">{r.address}</p>}
          <p className="text-xs text-slate-400">{t('reported_at')} {formatBangladeshDateTime(r.created_at, lang)}</p>
          {r.image_url && <img src={r.image_url} alt="evidence" className="mt-2 max-h-56 rounded-lg border border-slate-200" />}
        </div>

        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="eyebrow">{t('detail_ai')}</p>
            {r.ai_status === 'failed' && (
              <button onClick={rerun} disabled={busy} className="btn btn-sm bg-amber-500 text-white hover:bg-amber-600">
                {t('detail_rerun')}
              </button>
            )}
          </div>
          <Row label={t('detail_category')} value={`${t(`cat_${r.category_ai}`)} — ${t('detail_citizen_said')}: ${r.category_citizen || '—'} · ${t('detail_confidence')} ${r.ai_confidence ?? '—'}`} />
          <Row label={t('detail_summary')} value={r.ai_summary || '—'} />
          {r.ai_summary_bn && <p className="text-sm text-slate-500">{r.ai_summary_bn}</p>}
          <Row label={t('col_severity')} value={`${r.severity_level} (${r.severity_score ?? '—'}/100)`} />
          {r.severity_rationale && <p className="text-xs text-slate-400 italic">{r.severity_rationale}</p>}
          {r.image_ai_note && <p className="text-sm text-violet-600">{r.image_ai_note}</p>}
          {r.suggested_actions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">{t('detail_actions')}</p>
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-0.5">
                {r.suggested_actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
        </div>

        {(r.is_duplicate_of || data.linked_duplicates.length > 0) && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm space-y-1">
            <p className="eyebrow text-amber-700">{t('detail_dup_links')}</p>
            {r.is_duplicate_of && (
              <p className="text-amber-800">Marked as duplicate of <Link className="underline font-medium" to={`/admin/reports/${r.is_duplicate_of}`}>report #{r.is_duplicate_of}</Link>{r.duplicate_score && ` (similarity ${r.duplicate_score})`}</p>
            )}
            {data.linked_duplicates.map((d) => (
              <p key={d.id} className="text-amber-800"><Link className="underline" to={`/admin/reports/${d.id}`}>{d.tracking_code}</Link> linked as duplicate (sim {d.duplicate_score})</p>
            ))}
          </div>
        )}

        <div className="card p-5">
          <p className="eyebrow mb-3">{t('detail_history')}</p>
          <ol className="border-l-2 border-civic-200 pl-4 space-y-3">
            {r.history.map((h, i) => (
              <li key={i} className="text-sm">
                <span className="font-semibold text-slate-800">{t(`st_${h.new_status}`)}</span>
                <span className="text-slate-400 text-xs ml-2">· {h.changed_by} · {formatBangladeshDateTime(h.created_at, lang)}</span>
                {!h.is_public && <span className="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 ml-2">{t('detail_internal')}</span>}
                {h.note && <p className="mt-0.5 text-slate-600">{h.note}</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <aside>
        <div className="card p-5 space-y-4 sticky top-4">
          <p className="eyebrow">{t('manage')}</p>
          <div>
            <label className="field-label" htmlFor="manage-dept">{t('manage_dept')}</label>
            <select id="manage-dept" className="field" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">{t('manage_unassigned')}</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="manage-status">{t('manage_status')}</label>
            <select id="manage-status" className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`st_${s}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="manage-note">{t('manage_note')}</label>
            <textarea id="manage-note" className="field h-20 resize-none" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" className="rounded" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} />
            {t('manage_visible')}
          </label>
          <button onClick={save} disabled={busy} className="btn btn-primary w-full">
            {busy ? t('manage_saving') : t('manage_save')}
          </button>
          <p className="text-xs text-slate-400">{t('contact')}: {r.contact_email || '—'}{r.contact_phone && ` · ${r.contact_phone}`}</p>
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div>
              <label className="field-label" htmlFor="manage-dup">{t('manage_duplicate_original')}</label>
              <input id="manage-dup" className="field" type="number" min="1" placeholder={t('manage_duplicate_original_ph')}
                value={originalReportId} onChange={(e) => setOriginalReportId(e.target.value)} />
            </div>
            <button onClick={saveDuplicateLink} disabled={busy} className="btn btn-outline w-full">
              {t('manage_duplicate_save')}
            </button>
            {r.is_duplicate_of && (
              <Link className="block text-sm text-civic-700 hover:underline" to={`/admin/reports/${r.is_duplicate_of}`}>
                {t('manage_duplicate_view_original')}
              </Link>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <p className="text-sm">
      <span className="font-semibold text-slate-700">{label}: </span>
      <span className="text-slate-600">{value}</span>
    </p>
  );
}
