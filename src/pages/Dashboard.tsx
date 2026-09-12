import { useNavigate } from 'react-router-dom';
import { Users, Plus } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  // Mock data for now
  const clients = [{ id: '1', name: 'Elle', lastUpdated: '2026-09-10' }];

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-600" />
          Client Dashboard
        </h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          <Plus className="w-5 h-5" /> New Client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {clients.map((client) => (
          <div 
            key={client.id} 
            onClick={() => navigate(`/editor/${client.id}`)}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">{client.name}</h2>
            <p className="text-sm text-gray-500">Last updated: {client.lastUpdated}</p>
            <button className="mt-4 text-sm font-medium text-blue-600">Edit Program &rarr;</button>
          </div>
        ))}
      </div>
    </div>
  );
}