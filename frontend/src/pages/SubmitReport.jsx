import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useLang } from '../context/LangContext.jsx';

const CATEGORIES = ['Pothole', 'Broken Streetlight', 'Water Leak', 'Illegal Dumping', 'Other'];
const DHAKA = [23.8103, 90.4125];

function audioFilename(mimeType) {
  if (mimeType.includes('mp4')) return 'reporting.m4a';
  if (mimeType.includes('ogg')) return 'reporting.ogg';
  if (mimeType.includes('wav')) return 'reporting.wav';
  return 'reporting.webm';
}

function PinPicker({ pos, onPick }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) });
  return pos ? <Marker position={pos} /> : null;
}

function MapRecenter({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.flyTo(pos, Math.max(map.getZoom(), 16), { animate: true, duration: 0.5 });
  }, [map, pos]);
  return null;
}

export default function SubmitReport() {
  const nav = useNavigate();
  const { t } = useLang();
  const [form, setForm] = useState({ description: '', category_citizen: '', address: '', contact_email: '', contact_phone: '' });
  const [imageFile, setImageFile] = useState(null);
  const [pos, setPos] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [locationStatus, setLocationStatus] = useState('');
  const [gpsBusy, setGpsBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const skipAddressLookup = useRef(false);
  const lookupRequest = useRef(0);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const set = (key) => (e) => {
    if (key === 'address') { lookupRequest.current += 1; skipAddressLookup.current = false; }
    setForm({ ...form, [key]: e.target.value });
  };

  useEffect(() => {
    const address = form.address.trim();
    if (skipAddressLookup.current) { skipAddressLookup.current = false; return undefined; }
    if (address.length < 3) { setLocationStatus(''); return undefined; }
    const coordMatch = address.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordMatch) {
      const lat = Number(coordMatch[1]), lng = Number(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) { setPos([lat, lng]); setLocationStatus(t('map_location_updated')); }
      return undefined;
    }
    const controller = new AbortController();
    const reqId = ++lookupRequest.current;
    const timer = setTimeout(async () => {
      setLocationStatus(t('map_location_searching'));
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=bd&q=${encodeURIComponent(address)}`, { signal: controller.signal });
        const results = await res.json();
        if (reqId !== lookupRequest.current) return;
        if (results[0]) { setPos([Number(results[0].lat), Number(results[0].lon)]); setLocationStatus(t('map_location_updated')); }
        else setLocationStatus(t('map_location_not_found'));
      } catch (err) { if (err.name !== 'AbortError') setLocationStatus(t('map_location_not_found')); }
    }, 700);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [form.address, t]);

  async function selectMapLocation(nextPos) {
    const reqId = ++lookupRequest.current;
    const [lat, lng] = nextPos;
    skipAddressLookup.current = true;
    setPos(nextPos);
    setForm((c) => ({ ...c, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }));
    setLocationStatus(t('map_location_searching'));
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
      const result = await res.json();
      if (reqId === lookupRequest.current && result.display_name) { skipAddressLookup.current = true; setForm((c) => ({ ...c, address: result.display_name })); }
      if (reqId === lookupRequest.current) setLocationStatus(t('map_location_updated'));
    } catch { if (reqId === lookupRequest.current) setLocationStatus(t('map_location_updated')); }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { setLocationStatus(t('map_gps_unavailable')); return; }
    setGpsBusy(true); setLocationStatus(t('map_gps_searching'));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setGpsBusy(false); void selectMapLocation([coords.latitude, coords.longitude]); },
      () => { setGpsBusy(false); setLocationStatus(t('map_gps_denied')); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  async function toggleVoiceRecording() {
    if (recording) { recorderRef.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setVoiceStatus(t('voice_unavailable')); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      streamRef.current = stream; recorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop()); streamRef.current = null; setRecording(false);
        const mimeType = recorder.mimeType || 'audio/webm';
        const audioFile = new File([new Blob(chunks, { type: mimeType })], audioFilename(mimeType), { type: mimeType });
        if (!audioFile.size) { setVoiceStatus(t('voice_empty')); return; }
        setTranscribing(true); setVoiceStatus(t('voice_transcribing'));
        try {
          const { text } = await api.transcribeAudio(audioFile);
          setForm((c) => ({ ...c, description: c.description ? `${c.description}\n${text}` : text }));
          setVoiceStatus(t('voice_complete'));
        } catch (err) { setVoiceStatus(err.message); }
        finally { setTranscribing(false); }
      };
      recorder.start(); setVoiceStatus(t('voice_recording')); setRecording(true);
    } catch { setVoiceStatus(t('voice_denied')); }
  }

  async function submit() {
    setError('');
    if (form.description.trim().length < 10) return setError(t('err_desc_short'));
    setBusy(true);
    try {
      const imageUpload = imageFile ? await api.uploadImage(imageFile) : null;
      const data = await api.submitReport({
        ...form,
        category_citizen: form.category_citizen || null,
        image_path: imageUpload?.image_path || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        lat: pos?.[0] ?? null, lng: pos?.[1] ?? null,
      });
      nav(`/success/${data.tracking_code}`, { state: { possibleDuplicate: data.possible_duplicate, originalTrackingCode: data.original_tracking_code, reportedAt: data.reported_at } });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {busy && (
        <div role="status" aria-live="polite" aria-label={t('submit_loading_title')}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm card p-8 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-civic-100 border-t-civic-700" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">{t('submit_loading_title')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('submit_loading_desc')}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <p className="eyebrow mb-1">{t('nav_report')}</p>
          <h1>{t('submit_title')}</h1>
        </div>

        {error && <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">{error}</div>}

        <div className="card p-5 space-y-4">
          <p className="eyebrow">{t('submit_issue_section')}</p>
          <div>
            <label className="field-label" htmlFor="report-description">{t('submit_desc_label')}</label>
            <textarea id="report-description" className="field h-28 resize-none" placeholder={t('submit_desc_ph')}
              aria-describedby="description-help" value={form.description} onChange={set('description')} />
            <span id="description-help" className="mt-1 block text-xs text-slate-400">{t('submit_desc_help')}</span>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={toggleVoiceRecording} disabled={transcribing}
              className={`btn btn-sm ${recording ? 'border border-rose-500 text-rose-600 hover:bg-rose-50' : 'btn-outline'}`}>
              {recording ? t('voice_stop') : t('voice_start')}
            </button>
            {voiceStatus && <span role="status" className="text-xs text-slate-500">{voiceStatus}</span>}
          </div>
          <div>
            <label className="field-label" htmlFor="report-category">{t('submit_category_label')}</label>
            <select id="report-category" className="field" value={form.category_citizen} onChange={set('category_citizen')}>
              <option value="">{t('submit_category_ph')}</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat_${c}`)}</option>)}
            </select>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <p className="eyebrow">{t('submit_location_section')}</p>
          <div>
            <label className="field-label" htmlFor="report-address">{t('submit_address_ph')}</label>
            <div className="flex gap-2">
              <input id="report-address" className="field" placeholder={t('submit_address_ph')} value={form.address} onChange={set('address')} />
              <button type="button" onClick={useCurrentLocation} disabled={gpsBusy} className="btn btn-outline btn-sm whitespace-nowrap">
                {gpsBusy ? t('map_gps_busy') : t('map_gps_btn')}
              </button>
            </div>
          </div>
          {locationStatus && <p role="status" className="rounded-lg bg-civic-50 border border-civic-100 p-2 text-xs text-civic-800">{locationStatus}</p>}
        </div>

        <div className="card p-5 space-y-4">
          <p className="eyebrow">{t('submit_optional_section')}</p>
          <div>
            <label className="field-label" htmlFor="report-photo">{t('submit_photo_ph')}</label>
            <input id="report-photo" className="field" type="file" accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
            {imageFile && <span className="mt-1 block text-xs text-slate-400">{t('submit_photo_selected')}: {imageFile.name}</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="report-email">{t('submit_email_ph')}</label>
              <input id="report-email" className="field" placeholder={t('submit_email_ph')} value={form.contact_email} onChange={set('contact_email')} />
            </div>
            <div>
              <label className="field-label" htmlFor="report-phone">{t('submit_phone_ph')}</label>
              <input id="report-phone" className="field" placeholder={t('submit_phone_ph')} value={form.contact_phone} onChange={set('contact_phone')} />
            </div>
          </div>
        </div>

        <button onClick={submit} disabled={busy || recording || transcribing} className="btn btn-primary w-full py-3">
          {busy ? t('submit_btn_busy') : t('submit_btn')}
        </button>
      </div>

      <div>
        <p className="text-sm text-slate-500 mb-2">{t('submit_map_hint')}</p>
        <MapContainer center={DHAKA} zoom={12} style={{ height: 420 }} className="rounded-xl border border-slate-200">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          <MapRecenter pos={pos} />
          <PinPicker pos={pos} onPick={selectMapLocation} />
        </MapContainer>
        {pos && <p className="text-xs text-slate-400 mt-1 font-mono">{t('submit_pinned')}: {pos[0].toFixed(5)}, {pos[1].toFixed(5)}</p>}
      </div>
    </div>
  );
}
