import { useLang } from '../context/LangContext.jsx';

const STATUS_CLASS = {
  Submitted:      'bg-sky-50 text-sky-700 ring-sky-200',
  'Under Review': 'bg-violet-50 text-violet-700 ring-violet-200',
  Assigned:       'bg-indigo-50 text-indigo-700 ring-indigo-200',
  'In Progress':  'bg-amber-50 text-amber-700 ring-amber-200',
  Resolved:       'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Rejected:       'bg-rose-50 text-rose-700 ring-rose-200',
};

export default function StatusBadge({ status }) {
  const { t } = useLang();
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLASS[status] || 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
      {t(`st_${status}`)}
    </span>
  );
}
