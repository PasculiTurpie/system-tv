import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useChannelsApi } from '../services/channels.api.js';
import { useUIStore } from '../store/useUIStore.js';

export default function ChannelList() {
  const { listChannels, createChannel, deleteChannel, duplicateChannel, versionChannel } =
    useChannelsApi();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const permissions = useUIStore((state) => state.permissions);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listChannels({ query, page })
      .then((response) => {
        if (!active) return;
        setChannels(response.items);
      })
      .catch((err) => {
        if (!active) return;
        setError(err);
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [query, page, listChannels]);

  const filtered = useMemo(() => {
    return channels.filter((channel) => channel.name.toLowerCase().includes(query.toLowerCase()));
  }, [channels, query]);

  const handleCreate = async () => {
    const channel = await createChannel({ name: 'Nuevo Canal', nodes: [], edges: [] });
    setChannels((prev) => [channel, ...prev]);
  };

  const handleDelete = async (id) => {
    await deleteChannel(id);
    setChannels((prev) => prev.filter((channel) => channel.id !== id));
  };

  const handleDuplicate = async (id) => {
    const channel = await duplicateChannel(id);
    setChannels((prev) => [channel, ...prev]);
  };

  const handleVersion = async (id) => {
    await versionChannel(id);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Canales</h1>
          <p className="text-sm text-slate-400">Gestiona y navega tus diagramas de señales.</p>
        </div>
        {permissions.canEdit && (
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-md border border-sky-500 bg-sky-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            Nuevo canal
          </button>
        )}
      </div>
      <div className="sticky top-16 z-20 flex items-center gap-3 rounded-md border border-slate-800 bg-slate-900/80 px-4 py-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar canal"
          className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
          aria-label="Buscar canal"
        />
        <span className="text-xs text-slate-400">{filtered.length} resultados</span>
      </div>
      {loading && <p className="text-sm text-slate-400">Cargando...</p>}
      {error && <p className="text-sm text-rose-400">Error: {error.message}</p>}
      <ul className="grid gap-3">
        {filtered.map((channel) => (
          <li
            key={channel.id}
            className="rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3 shadow"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Link
                  to={`/channels/${channel.id}`}
                  className="text-lg font-medium text-white hover:underline"
                >
                  {channel.name}
                </Link>
                <p className="text-xs text-slate-400">Actualizado {channel.updatedAt}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Link
                  to={`/channels/${channel.id}`}
                  className="rounded-md border border-slate-700 px-3 py-1 hover:border-sky-500"
                >
                  Editar
                </Link>
                {permissions.canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(channel.id)}
                      className="rounded-md border border-slate-700 px-3 py-1 hover:border-sky-500"
                    >
                      Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVersion(channel.id)}
                      className="rounded-md border border-slate-700 px-3 py-1 hover:border-sky-500"
                    >
                      Versionar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(channel.id)}
                      className="rounded-md border border-rose-700 px-3 py-1 text-rose-400 hover:bg-rose-500/10"
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-end gap-2 text-xs text-slate-400">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded-md border border-slate-700 px-3 py-1 disabled:opacity-40"
          disabled={page === 1}
        >
          Anterior
        </button>
        <span>Página {page}</span>
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="rounded-md border border-slate-700 px-3 py-1"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
