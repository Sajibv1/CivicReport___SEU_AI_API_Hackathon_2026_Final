import { createContext, useContext, useState } from 'react';
import { DICT } from '../i18n/dict.js';

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  const change = (l) => {
    setLang(l);
    localStorage.setItem('lang', l);
  };
  const toggle = () => change(lang === 'en' ? 'bn' : 'en');

  // t(key) → translated string; falls back to the key itself if missing.
  const t = (key) => DICT[lang]?.[key] ?? DICT.en[key] ?? key;

  return (
    <LangContext.Provider value={{ lang, setLang: change, toggle, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
