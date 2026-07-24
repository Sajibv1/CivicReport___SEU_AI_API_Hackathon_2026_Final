const BANGLADESH_TIME_ZONE = 'Asia/Dhaka';

export function formatBangladeshDateTime(value, lang) {
  if (!value) return '—';

  const source = String(value);
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(source);
  const date = new Date(hasTimeZone ? source : `${source}Z`);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    timeZone: BANGLADESH_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
