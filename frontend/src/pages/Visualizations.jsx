import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '../api/client.js';
import { useLang } from '../context/LangContext.jsx';

const STATUS_COLORS = {
  Submitted:      '#38bdf8',
  'Under Review': '#a78bfa',
  Assigned:       '#818cf8',
  'In Progress':  '#fbbf24',
  Resolved:       '#34d399',
  Rejected:       '#fb7185',
};
const FALLBACK_COLORS = ['#2dd4bf', '#0d9488', '#0f766e', '#115e59', '#134e4a', '#5eead4'];

export default function Visualizations() {
  const { t } = useLang();
  const [period, setPeriod] = useState('day');
  const [trend, setTrend] = useState({ statuses: [], series: [] });
  const [selectedBucket, setSelectedBucket] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setError(''); setLoading(true);
    api.statusTrends(period)
      .then((data) => {
        if (!active) return;
        setTrend(data);
        setSelectedBucket(data.series.at(-1)?.period || '');
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period]);

  const selectedSeries = trend.series.find((s) => s.period === selectedBucket);
  const chartData = Object.entries(selectedSeries?.statuses || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <p className="eyebrow mb-0.5">{t('nav_admin')}</p>
          <h1>{t('viz_title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('viz_desc')}</p>
        </div>
        <Link to="/admin" className="ml-auto btn btn-ghost btn-sm">← {t('detail_back')}</Link>
      </div>

      <div className="flex gap-2">
        {['day', 'month', 'year'].map((v) => (
          <button key={v} onClick={() => setPeriod(v)}
            className={`btn btn-sm ${period === v ? 'btn-primary' : 'btn-ghost'}`}>
            {t(`viz_${v}`)}
          </button>
        ))}
      </div>

      {!!trend.series.length && (
        <div className="max-w-sm">
          <label className="field-label" htmlFor="viz-period">{t('viz_period_label')}</label>
          <select id="viz-period" className="field" value={selectedBucket} onChange={(e) => setSelectedBucket(e.target.value)}>
            {trend.series.slice().reverse().map((s) => <option key={s.period} value={s.period}>{s.period}</option>)}
          </select>
        </div>
      )}

      {loading && <div role="status" className="card p-6 text-center text-sm text-slate-500">{t('loading')}</div>}
      {error && <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">{error}</div>}
      {!loading && !error && !chartData.length && (
        <div className="card p-8 text-center text-slate-400 text-sm">{t('viz_no_data')}</div>
      )}
      {!loading && !!chartData.length && (
        <div className="card p-6" style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip formatter={(value, name) => [value, t(`st_${name}`)]} />
              <Legend formatter={(name) => t(`st_${name}`)} />
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%"
                label={({ name, percent }) => `${t(`st_${name}`)} ${(percent * 100).toFixed(0)}%`}>
                {chartData.map((entry, i) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
