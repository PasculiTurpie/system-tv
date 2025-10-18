import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore.js';
import { useDiagramMeta } from '../store/useDiagramStore.js';
import { useUIStore } from '../store/useUIStore.js';

const links = [
  { to: '/', label: 'Canales' },
];

export default function TopBar() {
  const { user, logout } = useAuthStore();
  const { status, lastSavedAt } = useDiagramMeta();
  const { theme, toggleTheme } = useUIStore();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-slate-900/80 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-semibold tracking-tight text-sky-300">
            Signal Studio
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `px-2 py-1 rounded-md transition ${
                    isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {location.pathname.startsWith('/channels/') && (
            <span aria-live="polite">
              {status === 'saving' && 'Guardando...'}
              {status === 'dirty' && 'Cambios pendientes'}
              {status === 'saved' && lastSavedAt && `Guardado ${lastSavedAt.toLocaleTimeString()}`}
            </span>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="px-2 py-1 rounded-md border border-slate-700 hover:bg-slate-800"
            aria-label="Cambiar tema"
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
          <div className="flex items-center gap-2">
            <span>{user?.name ?? 'Invitado'}</span>
            {user && (
              <button
                type="button"
                onClick={logout}
                className="px-2 py-1 rounded-md border border-slate-700 hover:bg-slate-800"
              >
                Salir
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
