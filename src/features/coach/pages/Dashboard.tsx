import { useEffect, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, MapPin, LogOut, AlertTriangle, Menu } from 'lucide-react';
import { getClients, createClient, setClientStatus, type Client, type NewClientInput } from '../../../lib/storage';
import ClientProfileModal from '../../../components/ClientProfileModal';
import { logout } from '../../../lib/auth';

export default function Dashboard() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getClients()
      .then((data) => {
        if (!cancelled) setClients(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load clients.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateClient = async (input: NewClientInput) => {
    const client = await createClient(input);
    setClients((prev) => [client, ...prev]);
    setShowNewClient(false);
    navigate(`/client/${client.id}`);
  };

  // Archiving is one-click to reactivate (harmless - nothing was hidden or
  // locked from the coach's own side) but confirms first when deactivating,
  // since that's the direction that changes what the client sees.
  const [archiveTarget, setArchiveTarget] = useState<Client | null>(null);
  // Surfaces a failed status change (e.g. the `status` column migration hasn't
  // been run against this Supabase project yet) instead of the toggle just
  // silently doing nothing - see Claude outputs/client-status-migration.sql.
  const [statusError, setStatusError] = useState<string | null>(null);

  const applyStatusChange = async (client: Client, status: Client['status']) => {
    setStatusError(null);
    // Optimistic - flips the switch right away so the click feels responsive,
    // then reverts (and reports why) if the update actually failed server-side.
    const previous = clients;
    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, status } : c)));
    try {
      const updated = await setClientStatus(client.id, status);
      if (updated) {
        setClients((prev) => prev.map((c) => (c.id === client.id ? updated : c)));
      } else {
        setClients(previous);
        setStatusError('That client could not be found - try refreshing the page.');
      }
    } catch (err) {
      setClients(previous);
      setStatusError(err instanceof Error ? err.message : 'Failed to update client status.');
    }
  };

  const handleToggleStatus = (client: Client, e: MouseEvent) => {
    e.stopPropagation(); // don't also trigger the card's own onClick (navigate to the client)
    if (client.status === 'inactive') {
      void applyStatusChange(client, 'active');
    } else {
      setArchiveTarget(client);
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    const target = archiveTarget;
    setArchiveTarget(null);
    await applyStatusChange(target, 'inactive');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 pt-10 sm:p-8 sm:pt-12">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
          <Users className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
          Client Dashboard
        </h1>

        {/* Tablet/desktop: both actions visible, same as always. */}
        <div className="hidden sm:flex items-center gap-2">
          <button onClick={() => setShowNewClient(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Plus className="w-5 h-5" /> New Client
          </button>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>

        {/* Phones: the same two actions collapse into a hamburger, so the header
            is just the title at a glance instead of the title and two buttons
            competing for a narrow row. */}
        <div className="sm:hidden relative">
          <button
            onClick={() => setShowMobileMenu((o) => !o)}
            aria-label="Dashboard actions"
            className="bg-off-white border border-gray-300 p-2.5 rounded-lg flex items-center justify-center hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            <Menu className="w-5 h-5" />
          </button>
          {showMobileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMobileMenu(false)} />
              <div className="absolute right-0 mt-2 w-52 bg-off-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
                <button
                  onClick={() => { setShowMobileMenu(false); setShowNewClient(true); }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> New Client
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700" />
                <button
                  onClick={() => { setShowMobileMenu(false); handleLogout(); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {statusError && (
        <p className="text-sm text-red-500 mb-4">{statusError}</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading clients…</p>
      ) : loadError ? (
        <p className="text-sm text-red-500">{loadError}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {clients.map((client) => {
            const fullName = [client.firstName, client.lastName].filter(Boolean).join(' ');
            const isInactive = client.status === 'inactive';
            return (
              <div
                key={client.id}
                onClick={() => navigate(`/client/${client.id}`)}
                className={`bg-off-white p-6 rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-shadow dark:bg-gray-800 ${
                  isInactive ? 'border-gray-200 opacity-60 dark:border-gray-700' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h2 className="text-xl font-semibold truncate">{client.nickname}</h2>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!isInactive}
                    aria-label={isInactive ? `Reactivate ${client.nickname}` : `Mark ${client.nickname} inactive`}
                    title={isInactive ? 'Inactive - click to reactivate' : 'Active - click to mark inactive'}
                    onClick={(e) => handleToggleStatus(client, e)}
                    className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isInactive ? 'bg-gray-300 dark:bg-gray-600' : 'bg-green-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isInactive ? 'translate-x-1' : 'translate-x-6'
                      }`}
                    />
                  </button>
                </div>
                {isInactive && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">Inactive</p>
                )}
                {fullName && <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{fullName}</p>}
                {client.location && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {client.location}
                  </p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {client.lastUpdated
                    ? `Last updated: ${new Date(client.lastUpdated).toLocaleString()}`
                    : 'No programs saved yet'}
                </p>
                <button className="mt-4 text-sm font-medium text-blue-600 dark:text-blue-400">View Program &rarr;</button>
              </div>
            );
          })}
        </div>
      )}

      {showNewClient && (
        <ClientProfileModal mode="create" onClose={() => setShowNewClient(false)} onSubmit={handleCreateClient} />
      )}

      {archiveTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setArchiveTarget(null)}>
          <div
            className="bg-off-white dark:bg-gray-800 rounded-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-2">
              <span className="shrink-0 w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </span>
              <h2 className="text-lg font-bold pt-1.5 text-gray-900 dark:text-gray-100">
                Mark {archiveTarget.nickname} inactive?
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 text-justify">
              {archiveTarget.nickname} will no longer see their program - their dashboard will show empty until
              you reactivate them. You&apos;ll still be able to view their profile and past program history, but
              editing or starting a new program is locked until they&apos;re active again.
            </p>
            <div className="flex justify-end items-center gap-2">
              <button
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmArchive}
                className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700"
              >
                Mark Inactive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
