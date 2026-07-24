import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LangContext.jsx';
import StatusBadge from './StatusBadge.jsx';

const DHAKA = [23.8103, 90.4125];

// Severity → pin color. Uses Leaflet divIcon so we avoid shipping marker images.
const SEV_HEX = { Critical: '#e11d48', High: '#ea580c', Medium: '#d97706', Low: '#059669' };

function pinIcon(severity) {
  const color = SEV_HEX[severity] || '#2563eb';
  return L.divIcon({
    className: 'civic-pin',
    html: `<span style="
      display:inline-block;width:16px;height:16px;border-radius:50%;
      background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function MapView({ reports }) {
  const { t } = useLang();
  const pins = reports.filter((r) => r.lat != null && r.lng != null);

  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-xs text-slate-600">
        {Object.entries(SEV_HEX).map(([label, hex]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: hex }} />
            {label}
          </span>
        ))}
      </div>
      <MapContainer center={DHAKA} zoom={12} style={{ height: 480 }} className="rounded border">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors" />
        {pins.map((r) => (
          <Marker key={r.id} position={[r.lat, r.lng]} icon={pinIcon(r.severity_level)}>
            <Popup>
              <div className="space-y-1">
                <div className="font-mono font-semibold">{r.tracking_code}</div>
                <div>{t(`cat_${r.category_ai}`)} · {r.severity_level} ({r.severity_score ?? '—'})</div>
                <StatusBadge status={r.status} />
                {r.address && <div className="text-slate-500">{r.address}</div>}
                <Link className="text-civic-700 underline" to={`/admin/reports/${r.id}`}>{t('col_manage')} →</Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {!pins.length && <p className="text-center text-slate-400 text-sm py-4">{t('map_empty')}</p>}
    </div>
  );
}
