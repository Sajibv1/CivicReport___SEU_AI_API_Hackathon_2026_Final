import { useLang } from '../context/LangContext.jsx';

export default function LangToggle() {
  const { toggle, t } = useLang();
  return (
    <button
      onClick={toggle}
      className="text-sm border rounded px-3 py-1 text-slate-700 hover:bg-slate-100"
      title="Switch language / ভাষা পরিবর্তন করুন"
    >
      {t('lang_label')}
    </button>
  );
}
