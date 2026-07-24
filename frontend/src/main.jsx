import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import './index.css';
import { LangProvider, useLang } from './context/LangContext.jsx';
import LangToggle from './components/LangToggle.jsx';
import SubmitReport from './pages/SubmitReport.jsx';
import Success from './pages/Success.jsx';
import TrackReport from './pages/TrackReport.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ReportDetail from './pages/ReportDetail.jsx';
import Visualizations from './pages/Visualizations.jsx';
import { getSessionToken } from './api/client.js';

function Nav() {
  const { t } = useLang();
  const linkCls = ({ isActive }) =>
    `text-sm font-medium transition-colors ${isActive ? 'text-civic-700' : 'text-slate-500 hover:text-slate-900'}`;
  return (
    <nav className="bg-white border-b border-slate-200 px-4 py-3 flex gap-6 items-center">
      <Link to="/" className="font-bold text-civic-700 font-mono tracking-tight">{t('app_name')}</Link>
      <NavLink to="/" end className={linkCls}>{t('nav_report')}</NavLink>
      <NavLink to="/track" className={linkCls}>{t('nav_track')}</NavLink>
      <div className="ml-auto flex items-center gap-4">
        <NavLink to="/admin" className={linkCls}>{t('nav_admin')}</NavLink>
        <LangToggle />
      </div>
    </nav>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <BrowserRouter>
        <Nav />
        <main className="max-w-5xl mx-auto p-4">
          <Routes>
            <Route path="/" element={<SubmitReport />} />
            <Route path="/success/:code" element={<Success />} />
            <Route path="/track" element={<TrackReport />} />
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/visualizations" element={<AdminOnly><Visualizations /></AdminOnly>} />
            <Route path="/admin/reports/:id" element={<ReportDetail />} />
          </Routes>
        </main>
      </BrowserRouter>
    </LangProvider>
  </React.StrictMode>
);

function AdminOnly({ children }) {
  return getSessionToken() ? children : <Navigate to="/admin" replace />;
}
