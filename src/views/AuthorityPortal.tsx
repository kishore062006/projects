import { useState, useEffect } from 'react';
import { MapPin, AlertCircle, CheckCircle, Clock, Filter, CheckSquare, List } from 'lucide-react';
// ADDED: Leaflet Map Imports
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import * as L from 'leaflet';
import { API_BASE } from '../lib/api';

// Fix for default Leaflet marker icons in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ADDED: Helper to parse coordinate string "40.7128° N, 74.0060° W" to [Lat, Lng] array
const parseCoords = (coordStr: string): [number, number] => {
  try {
    if (!coordStr || !coordStr.includes('°')) return [40.7128, -74.0060]; // Default fallback
    const parts = coordStr.split(',');
    let lat = parseFloat(parts[0].replace(/[^\d.-]/g, ''));
    let lng = parseFloat(parts[1].replace(/[^\d.-]/g, ''));
    if (parts[0].includes('S')) lat = -lat;
    if (parts[1].includes('W')) lng = -lng;
    return [lat, lng];
  } catch (e) {
    return [40.7128, -74.0060];
  }
};

export function AuthorityPortal() {
  const [issues, setIssues] = useState<any[]>([]);
  // ADDED: View mode state
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');

  useEffect(() => {
    const loadIssues = async () => {
      if (API_BASE) {
        try {
          const response = await fetch(`${API_BASE}/api/reports`);
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
              setIssues(data);
              localStorage.setItem('ecoSyncReports', JSON.stringify(data));
              return;
            }
          }
        } catch {
          // Fall back to local data.
        }
      }

      const savedReports = JSON.parse(localStorage.getItem('ecoSyncReports') || '[]');
      setIssues(savedReports);
    };

    void loadIssues();
  }, []);

  const handleMarkResolved = async (id: string) => {
    let resolvedViaApi = false;

    if (API_BASE) {
      try {
        const response = await fetch(`${API_BASE}/api/reports/${id}/resolve`, {
          method: 'PATCH',
        });

        if (response.ok) {
          const updatedReport = await response.json();
          const nextIssues = issues.map((issue) => (issue.id === id ? updatedReport : issue));
          setIssues(nextIssues);
          localStorage.setItem('ecoSyncReports', JSON.stringify(nextIssues));
          resolvedViaApi = true;
        }
      } catch {
        // Fall back to local update.
      }
    }

    if (!resolvedViaApi) {
      const updatedIssues = issues.map((issue) =>
        issue.id === id ? { ...issue, status: 'Resolved', time: 'Resolved' } : issue
      );
      setIssues(updatedIssues);

      const savedReports = JSON.parse(localStorage.getItem('ecoSyncReports') || '[]');
      const updatedSavedReports = savedReports.map((report: any) =>
        report.id === id ? { ...report, status: 'Resolved', time: 'Resolved' } : report
      );
      localStorage.setItem('ecoSyncReports', JSON.stringify(updatedSavedReports));

      const currentPoints = parseInt(localStorage.getItem('ecoPoints') || '0');
      localStorage.setItem('ecoPoints', (currentPoints + 150).toString());
    }

    alert(`Ticket ${id} marked as Resolved! The reporter has been awarded 150 bonus Leaves.`);
  };

  const openTicketsCount = issues.filter(i => i.status === 'Open').length;
  const resolvedTicketsCount = issues.filter(i => i.status === 'Resolved').length;

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#0a0a0a] text-zinc-300 p-8 pl-[300px] md:pl-[320px] font-mono">
      <header className="mb-8 flex justify-between items-end border-b border-zinc-800 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
            Civic Command Center
          </h2>
          <p className="text-zinc-500 text-sm mt-2">Real-time crowdsourced environmental issue tracking.</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Open Tickets</p>
            <p className="text-2xl font-bold text-red-400">{openTicketsCount}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Resolved</p>
            <p className="text-2xl font-bold text-emerald-400">{resolvedTicketsCount}</p>
          </div>
        </div>
      </header>

      <div className="flex gap-4 mb-6">
        <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm hover:bg-zinc-800 transition-colors">
          <Filter size={16} /> Filter by SDG
        </button>
        
        {/* ADDED: View Toggle Buttons */}
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <button 
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${viewMode === 'table' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-800/50'}`}
          >
            <List size={16} /> Table View
          </button>
          <button 
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${viewMode === 'map' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-800/50'}`}
          >
            <MapPin size={16} /> Map View
          </button>
        </div>
      </div>

      {/* ADDED: Conditional Rendering for Map vs Table */}
      {viewMode === 'map' ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden h-[600px] relative z-0">
          <MapContainer 
            center={[40.7128, -74.0060]} 
            zoom={12} 
            style={{ height: '100%', width: '100%', zIndex: 0 }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" // Dark mode map tiles!
            />
            {issues.map((issue) => (
              <Marker key={issue.id} position={parseCoords(issue.location)}>
                <Popup className="custom-popup">
                  <div className="p-1 font-sans">
                    <h3 className="font-bold text-sm mb-1">{issue.type}</h3>
                    <p className="text-xs text-gray-600 mb-2">Reported by: {issue.reporter}</p>
                    <span className={`px-2 py-1 rounded text-xs font-bold text-white ${
                      issue.status === 'Open' ? 'bg-red-500' :
                      issue.status === 'In Progress' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}>
                      {issue.status}
                    </span>
                    {issue.status !== 'Resolved' && (
                      <button 
                        onClick={() => handleMarkResolved(issue.id)}
                        className="w-full py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-bold transition-colors"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      ) : (
        /* ORIGINAL TABLE CODE (Untouched) */
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-xs">
              <tr>
                <th className="p-4 font-medium">Ticket ID</th>
                <th className="p-4 font-medium">Issue Type</th>
                <th className="p-4 font-medium">Location</th>
                <th className="p-4 font-medium">Priority</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Reported By</th>
                <th className="p-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {issues.map((issue) => (
                <tr key={issue.id} className="hover:bg-zinc-800/30 transition-colors cursor-pointer group">
                  <td className="p-4 text-white font-medium">{issue.id}</td>
                  <td className="p-4">{issue.type}</td>
                  <td className="p-4 flex items-center gap-2 truncate max-w-[200px]">
                    <MapPin size={14} className="text-zinc-500 shrink-0" />
                    {issue.location}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${
                      issue.priority === 'Critical' ? 'bg-red-500/20 text-red-400' :
                      issue.priority === 'High' ? 'bg-orange-500/20 text-orange-400' :
                      issue.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {issue.priority}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      {issue.status === 'Open' && <AlertCircle size={14} className="text-red-400" />}
                      {issue.status === 'In Progress' && <Clock size={14} className="text-amber-400" />}
                      {issue.status === 'Resolved' && <CheckCircle size={14} className="text-emerald-400" />}
                      <span className={
                        issue.status === 'Open' ? 'text-red-400' :
                        issue.status === 'In Progress' ? 'text-amber-400' :
                        'text-emerald-400'
                      }>{issue.status}</span>
                    </div>
                  </td>
                  <td className="p-4 text-zinc-500">{issue.reporter}</td>
                  <td className="p-4">
                    {issue.status !== 'Resolved' ? (
                      <button 
                        onClick={() => handleMarkResolved(issue.id)}
                        className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-md transition-colors text-xs font-bold"
                      >
                        <CheckSquare size={14} /> Resolve
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-600 font-bold uppercase tracking-wider">Closed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}