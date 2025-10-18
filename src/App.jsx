import { Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Routes from './app/routes.jsx';
import TopBar from './components/TopBar.jsx';
import { useAuthStore } from './store/useAuthStore.js';

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);
  return null;
}

export default function App() {
  const { bootstrap } = useAuthStore();

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      <TopBar />
      <ScrollToTop />
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="p-6">Cargando...</div>}>
          <Routes />
        </Suspense>
      </main>
    </div>
  );
}
