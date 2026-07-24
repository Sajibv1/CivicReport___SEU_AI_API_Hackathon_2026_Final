import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useLang } from '../context/LangContext.jsx';
import { formatBangladeshDateTime } from '../i18n/time.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function TrackReport() {
  const { lang, t } = useLang();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function lookup(codeArg) {
    const c = (codeArg ?? code).trim();
    if (!c) return;
    setError(''); setData(null); setBusy(true);
    try { setData(await api.track(c)); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // Auto-lookup when arriving from a QR scan / success link (?code=CVR-XXXXXX).
  useEffect(() => {
    const c = params.get('code');
    if (c) lookup(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <p className="eyebrow mb-1">{t('nav_track')}</p>
        <h1>{t('track_title')}</h1>
      </div>

      <div>
        <label className="field-label" htmlFor="track-code">{t('track_title')}</label>
        <div className="flex gap-2">
          <input id="track-code" className="field flex-1 font-mono" placeholder="CVR-XXXXXX"
            value={code} onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup()} />
          <button onClick={() => lookup()} disabled={busy} className="btn btn-primary">
            {busy ? '…' : t('track_btn')}
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">{error}</div>}
      {busy && <div role="status" className="card p-4 text-sm text-slate-500">{t('loading')}</div>}

      {data && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <StatusBadge status={data.status} />
            <span className="text-xs text-slate-400 font-mono">{code}</span>
          </div>

          <p className="text-sm text-slate-800">{data.description}</p>
          <p className="text-xs text-slate-400">{t('reported_at')} {formatBangladeshDateTime(data.created_at, lang)}</p>

          {data.original_tracking_code && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              {t('track_duplicate_link')}{' '}
              <Link className="underline font-medium" to={`/track?code=${encodeURIComponent(data.original_tracking_code)}`}>
                {data.original_tracking_code}
              </Link>
            </div>
          )}

          {data.department && (
            <p className="text-sm text-slate-600">{t('track_assigned_to')} <span className="font-semibold text-slate-800">{data.department.name}</span></p>
          )}

          <div>
            <p className="eyebrow mb-3">{t('track_progress')}</p>
            <ol className="border-l-2 border-civic-200 pl-4 space-y-3">
              {data.history.map((h, i) => (
                <li key={i} className="text-sm">
                  <span className="font-semibold text-slate-800">{t(`st_${h.new_status}`)}</span>
                  <span className="text-slate-400 text-xs ml-2">· {formatBangladeshDateTime(h.created_at, lang)}</span>
                  {h.note && <p className="mt-0.5 text-slate-600">{h.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
