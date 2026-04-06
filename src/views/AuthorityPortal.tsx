import { useState, useEffect } from 'react';
import { MapPin, AlertCircle, CheckCircle, Clock, Filter, CheckSquare, List, X } from 'lucide-react';
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

// ADDED: Helper to parse coordinate string "12.9716° N, 77.5946° E" to [Lat, Lng] array
const parseCoords = (coordStr: string): [number, number] => {
  try {
    if (!coordStr) return [12.9716, 77.5946];

    const decimalParts = coordStr.split(',').map((part) => part.trim());
    if (decimalParts.length === 2 && !coordStr.includes('°')) {
      const lat = Number.parseFloat(decimalParts[0]);
      const lng = Number.parseFloat(decimalParts[1]);
      if (!Number.isNaN(lat) && !Number.isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return [lat, lng];
      }
    }

    if (!coordStr.includes('°')) return [12.9716, 77.5946]; // Default fallback
    const parts = coordStr.split(',');
    let lat = parseFloat(parts[0].replace(/[^\d.-]/g, ''));
    let lng = parseFloat(parts[1].replace(/[^\d.-]/g, ''));
    if (parts[0].includes('S')) lat = -lat;
    if (parts[1].includes('W')) lng = -lng;
    return [lat, lng];
  } catch (e) {
    return [12.9716, 77.5946];
  }
};

const getPriorityFromIssue = (issue: any): 'Critical' | 'High' | 'Medium' | 'Low' => {
  const explicitPriority = String(issue?.priority || '').trim();
  if (explicitPriority === 'Critical' || explicitPriority === 'High' || explicitPriority === 'Medium' || explicitPriority === 'Low') {
    return explicitPriority;
  }

  const issueType = String(issue?.type || '').toLowerCase();
  if (issueType.includes('water leakage') || issueType.includes('polluted water')) {
    return 'Critical';
  }
  if (issueType.includes('illegal dumping')) {
    return 'High';
  }
  if (issueType.includes('green infrastructure')) {
    return 'Medium';
  }
  return 'Low';
};

const getPriorityBadgeClass = (priority: string) => {
  if (priority === 'Critical') return 'bg-red-500/20 text-red-400';
  if (priority === 'High') return 'bg-orange-500/20 text-orange-400';
  if (priority === 'Medium') return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-blue-500/20 text-blue-400';
};

export function AuthorityPortal() {
  const currentUser = JSON.parse(localStorage.getItem('ecoSyncUser') || 'null') as { id?: string; role?: string } | null;
  const requesterId = String(currentUser?.id || '');
  const requesterRole = String(currentUser?.role || '');
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  // ADDED: View mode state
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');

  useEffect(() => {
    const loadIssues = async () => {
      if (API_BASE) {
        try {
          const response = await fetch(
            `${API_BASE}/api/reports?userId=${encodeURIComponent(requesterId)}&role=${encodeURIComponent(requesterRole)}`,
          );
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
              const normalizedData = data.map((issue) => ({
                ...issue,
                priority: getPriorityFromIssue(issue),
              }));
              setIssues(normalizedData);
              localStorage.setItem('ecoSyncReports', JSON.stringify(normalizedData));
              return;
            }
          }
        } catch {
          // Fall back to local data.
        }
      }

      const savedReports = JSON.parse(localStorage.getItem('ecoSyncReports') || '[]');
      const normalizedReports = savedReports.map((issue: any) => ({
        ...issue,
        priority: getPriorityFromIssue(issue),
      }));
      setIssues(normalizedReports);
    };

    void loadIssues();
  }, []);

  const handleMarkResolved = async (id: string) => {
    let resolvedViaApi = false;

    if (API_BASE) {
      try {
        const response = await fetch(`${API_BASE}/api/reports/${id}/resolve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: requesterRole }),
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
            center={[12.9716, 77.5946]} 
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
                    <p className="text-xs text-gray-600 mb-2">Priority: {getPriorityFromIssue(issue)}</p>
                    <span className={`px-2 py-1 rounded text-xs font-bold text-white ${
                      issue.status === 'Open' ? 'bg-red-500' :
                      issue.status === 'In Progress' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}>
                      {issue.status}
                    </span>
                    <button
                      onClick={() => setSelectedIssue(issue)}
                      className="w-full py-1 mt-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-bold transition-colors"
                    >
                      View Details
                    </button>
                    {issue.status !== 'Resolved' && (
                      <button 
                        onClick={() => handleMarkResolved(issue.id)}
                        className="w-full py-1 mt-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-bold transition-colors"
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
                <tr
                  key={issue.id}
                  onClick={() => setSelectedIssue(issue)}
                  className="hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                >
                  <td className="p-4 text-white font-medium">{issue.id}</td>
                  <td className="p-4">{issue.type}</td>
                  <td className="p-4 flex items-center gap-2 truncate max-w-[200px]">
                    <MapPin size={14} className="text-zinc-500 shrink-0" />
                    {issue.location}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${getPriorityBadgeClass(getPriorityFromIssue(issue))}`}>
                      {getPriorityFromIssue(issue)}
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
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleMarkResolved(issue.id);
                        }}
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

      {selectedIssue && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedIssue.type}</h3>
                <p className="text-xs text-zinc-400">Ticket: {selectedIssue.id} • Reported by {selectedIssue.reporter}</p>
              </div>
              <button
                onClick={() => setSelectedIssue(null)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              <div className="p-5 border-b md:border-b-0 md:border-r border-zinc-800">
                <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Uploaded Evidence</p>
                {selectedIssue.image ? (
                  <img
                    src={selectedIssue.image}
                    alt="Reported issue evidence"
                    className="w-full h-[320px] object-cover rounded-xl border border-zinc-700"
                  />
                ) : (
                  <div className="w-full h-[320px] rounded-xl border border-dashed border-zinc-700 text-zinc-500 flex items-center justify-center text-sm">
                    No image uploaded for this report.
                  </div>
                )}
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Priority</p>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getPriorityBadgeClass(getPriorityFromIssue(selectedIssue))}`}>
                    {getPriorityFromIssue(selectedIssue)}
                  </span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Location</p>
                  <p className="text-sm text-zinc-200">{selectedIssue.location}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Address</p>
                  <p className="text-sm text-zinc-200">{selectedIssue.address || 'No address provided.'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Description</p>
                  <p className="text-sm text-zinc-200 whitespace-pre-wrap">{selectedIssue.description || 'No details provided.'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}