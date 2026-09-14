import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, MapPin } from 'lucide-react';
import { getClients, createClient, type NewClientInput } from '../lib/storage';
import ClientProfileModal from '../components/ClientProfileModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const [clients, setClients] = useState(() => getClients());
  const [showNewClient, setShowNewClient] = useState(false);

  const handleCreateClient = (input: NewClientInput) => {
    const client = createClient(input);
    setClients(getClients());
    setShowNewClient(false);
    navigate(`/client/${client.id}`);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
          <Users className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
          Client Dashboard
        </h1>
        <button onClick={() => setShowNewClient(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          <Plus className="w-5 h-5" /> New Client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {clients.map((client) => {
          const fullName = [client.firstName, client.lastName].filter(Boolean).join(' ');
          return (
            <div
              key={client.id}
              onClick={() => navigate(`/client/${client.id}`)}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700"
            >
              <h2 className="text-xl font-semibold mb-1">{client.nickname}</h2>
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

      {showNewClient && (
        <ClientProfileModal mode="create" onClose={() => setShowNewClient(false)} onSubmit={handleCreateClient} />
      )}
    </div>
  );
}
