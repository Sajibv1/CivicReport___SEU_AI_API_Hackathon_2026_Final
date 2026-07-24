import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { useLang } from '../context/LangContext.jsx';
import { formatBangladeshDateTime } from '../i18n/time.js';

export default function Success() {
  const { code } = useParams();
  const { lang, t } = useLang();
  const location = useLocation();
  const dup = location.state?.possibleDuplicate;
  const originalTrackingCode = location.state?.originalTrackingCode;
  const reportedAt = location.state?.reportedAt;
  const [copied, setCopied] = useState(false);

  const trackUrl = `${window.location.origin}/track?code=${encodeURIComponent(code)}`;

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-md mx-auto text-center space-y-5 py-12">
      <div>
        <p className="eyebrow mb-1">{t('nav_report')}</p>
        <h1 className="text-emerald-600">{t('success_title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('success_save')}</p>
      </div>

      <div className="card p-6 space-y-3">
        <p className="text-xs text-slate-400 uppercase tracking-wider">Tracking code</p>
        <div className="font-mono text-3xl font-bold tracking-widest text-slate-900">{code}</div>
        {reportedAt && <p className="text-xs text-slate-400">{t('success_reported_at')} {formatBangladeshDateTime(reportedAt, lang)}</p>}
        <button onClick={copy} className="btn btn-ghost btn-sm mx-auto">
          {copied ? t('success_copied') : t('success_copy')}
        </button>
      </div>

      <div className="card p-5 space-y-2">
        <p className="text-sm text-slate-500">{t('success_scan')}</p>
        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-lg border border-slate-200 inline-block">
            <QRCodeCanvas value={trackUrl} size={160} includeMargin />
          </div>
        </div>
      </div>

      {dup && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm space-y-1">
          <p className="text-amber-800">{t('success_dup')}</p>
          {originalTrackingCode && (
            <Link className="underline font-medium text-amber-700" to={`/track?code=${encodeURIComponent(originalTrackingCode)}`}>
              {t('success_dup_link')}
            </Link>
          )}
        </div>
      )}

      <Link to={`/track?code=${encodeURIComponent(code)}`} className="btn btn-outline mx-auto">
        {t('success_track_link')}
      </Link>
    </div>
  );
}
