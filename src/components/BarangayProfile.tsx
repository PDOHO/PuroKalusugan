import React, { useState, useEffect } from 'react';
import { Plus, Search, MapPin, Users, Package, Info, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Barangay, User } from '../types';
import { MUNICIPALITIES, PRIORITY_PROGRAMS, MUNICIPALITIES_DATA, PROGRAM_DESCRIPTIONS, PROGRAM_TARGET_DEFINITIONS, ALLOWED_CUSTOM_PROGRAM2_BARANGAYS, formatMunicipality, formatBarangay } from '../constants';

interface BarangayProfileProps {
  currentUser: User;
}

export default function BarangayProfile({ currentUser }: BarangayProfileProps) {
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedProgram, setSelectedProgram] = useState('');

  const initialMunicipality = currentUser.role === 'MUNICIPALITY' ? currentUser.municipality! : '';

  const [formData, setFormData] = useState<Barangay>({
    municipality: initialMunicipality,
    barangay_name: '',
    puroks: 0,
    pk_teams: 0,
    pk_team_members: 0,
    pk_kits_received: 0,
    pk_members_oriented: 0,
    program1_target: 0,
    program2_name: '',
    program2_target: 0,
    program3_name: '',
    program3_target: 0,
    program4_name: '',
    program4_target: 0,
    actual_population: 0,
    projected_population: 0
  });

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchBarangays();
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedProgram, page, limit]);

  const fetchBarangays = () => {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      search: searchTerm,
      program: selectedProgram,
      municipality: currentUser.role === 'MUNICIPALITY' ? currentUser.municipality! : '',
      _t: Date.now().toString()
    });
    fetch(`/api/barangays?${query}`)
      .then(async res => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || data.error || `Server error: ${res.status}`);
          return data;
        } else {
          const text = await res.text();
          if (text.includes('Cookie check') || text.includes('Action required to load your app') || text.includes('__SECURE-aistudio')) {
             window.location.reload();
             return null;
          }
          if (text.includes('<!doctype html>')) {
             throw new Error(`Server returned HTML instead of API data. The server might be restarting or taking too long. Please try again later.`);
          }
          if (!res.ok) {
            throw new Error(`Server error: ${res.status} ${res.statusText}\n${text.substring(0, 100)}`);
          }
          throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
        }
      })
      .then(data => {
        if (!data) return; // Handled by reload
        if (data && data.data) {
          setBarangays(data.data);
          setTotal(data.total);
        } else {
          setBarangays(Array.isArray(data) ? data : []);
          setTotal(Array.isArray(data) ? data.length : 0);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Fetch error:", err);
        setError(err.message);
        setLoading(false);
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSaving) return;
    setIsSaving(true);
    
    // Check for duplicates before submitting (only for new entries)
    if (!editingId) {
      const isDuplicate = barangays.some(
        b => b.municipality === formData.municipality && 
             b.barangay_name.trim().toLowerCase() === formData.barangay_name.trim().toLowerCase()
      );
      
      if (isDuplicate) {
        alert(`Barangay "${formData.barangay_name.trim()}" already exists in ${formData.municipality}.`);
        setIsSaving(false);
        return;
      }
    }

    const url = '/api/barangays';
    const method = 'POST';
    
    const submissionData = {
      ...formData
    };
    if (!isProgram2Customizable(submissionData.municipality, submissionData.barangay_name)) {
      submissionData.program2_name = 'Immunization';
    }
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          ...submissionData, 
          id: editingId || undefined,
          _action: editingId ? 'update' : undefined,
          _user: {
            id: currentUser.id,
            username: currentUser.username,
            role: currentUser.role
          }
        })
      });
      
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (!contentType || contentType.indexOf("application/json") === -1) {
          const text = await res.text();
          throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
        }
        await res.json();
        setIsModalOpen(false);
        setEditingId(null);
        fetchBarangays();
        setFormData({
          municipality: initialMunicipality,
          barangay_name: '',
          puroks: 0,
          pk_teams: 0,
          pk_team_members: 0,
          pk_kits_received: 0,
          pk_members_oriented: 0,
          program1_target: 0,
          program2_name: 'Immunization',
          program2_target: 0,
          program3_name: '',
          program3_target: 0,
          program4_name: '',
          program4_target: 0,
          actual_population: 0,
          projected_population: 0
        });
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const errorData = await res.json();
          const debugTarget = res.headers.get('X-Debug-Target') || 'Unknown';
          alert(`Error saving barangay:
Status: ${res.status} ${res.statusText}
Target: ${debugTarget}
URL: ${url}
Method: POST
Error: ${errorData.error || "Failed to save barangay."}`);
        } else {
          const text = await res.text();
          alert(`Error saving barangay: ${res.statusText}\n${text.substring(0, 100)}`);
        }
      }
    } catch (error) {
      console.error("Error saving barangay:", error);
      alert("An error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (barangay: Barangay) => {
    const matchedMuni = MUNICIPALITIES.find(m => m.toLowerCase() === (barangay.municipality || '').toLowerCase());
    const normalizedMuni = matchedMuni || barangay.municipality || '';
    
    let normalizedBrgy = barangay.barangay_name || '';
    if (matchedMuni && barangay.barangay_name) {
      const barangays = MUNICIPALITIES_DATA[matchedMuni] || [];
      const matched = barangays.find(b => b.toLowerCase() === barangay.barangay_name.toLowerCase());
      if (matched) normalizedBrgy = matched;
    }

    setFormData({
      ...barangay,
      municipality: normalizedMuni,
      barangay_name: normalizedBrgy
    });
    setEditingId(barangay.id!);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this barangay profile?')) {
      try {
        // Use consolidated endpoint
        const res = await fetch('/api/barangays', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id, 
            _action: 'delete',
            _user: {
              id: currentUser.id,
              username: currentUser.username,
              role: currentUser.role
            }
          })
        });
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (!contentType || contentType.indexOf("application/json") === -1) {
            const text = await res.text();
            throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
          }
          await res.json();
          fetchBarangays();
        } else {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
            const errorData = await res.json();
            const debugTarget = res.headers.get('X-Debug-Target') || 'Unknown';
            console.error("Delete error:", errorData);
            
            if (errorData.error && (errorData.error.includes("foreign key constraint") || errorData.details?.code === '23503')) {
              alert("Cannot delete this barangay because it has associated patient records. Please delete or reassign the patients first.");
            } else {
              alert(`Error deleting barangay:
Status: ${res.status} ${res.statusText}
Target: ${debugTarget}
URL: /api/barangays
Method: POST
Error: ${errorData.error || "Failed to delete barangay."}`);
            }
          } else {
            const text = await res.text();
            alert(`Error deleting barangay: ${res.statusText}\n${text.substring(0, 100)}`);
          }
        }
      } catch (error: any) {
        console.error("Error deleting barangay:", error);
        alert(`An error occurred while deleting: ${error.message || "Unknown error"}`);
      }
    }
  };

  const handleMunicipalityChange = (municipality: string) => {
    setFormData({
      ...formData,
      municipality,
      barangay_name: '',
      program2_name: 'Immunization'
    });
  };

  const isProgram2Customizable = (municipality: string, barangay: string) => {
    return ALLOWED_CUSTOM_PROGRAM2_BARANGAYS.some(b => b.municipality === municipality && b.barangay === barangay);
  };

  const getAvailablePrograms = (currentProgramName: string) => {
    const selectedPrograms = [formData.program2_name, formData.program3_name, formData.program4_name];
    return PRIORITY_PROGRAMS.filter(p => (!selectedPrograms.includes(p) || p === currentProgramName));
  };

  const isNoTargetProgram = (programName: string) => {
    return programName === "Road Safety" || programName === "Mental Health";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto flex-1">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
            <input 
              type="text" 
              placeholder="Search barangay or municipality..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-charcoal-gray/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative w-full md:w-64">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-slate" size={18} />
            <select 
              className="w-full pl-10 pr-4 py-2 bg-white border border-charcoal-gray/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue transition-all appearance-none"
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
            >
              <option value="">All Priority Programs</option>
              {PRIORITY_PROGRAMS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
        {currentUser.role === 'ADMIN' && (
          <button 
            onClick={() => {
              setEditingId(null);
              setFormData({
                municipality: initialMunicipality,
                barangay_name: '',
                puroks: 0,
                pk_teams: 0,
                pk_team_members: 0,
                pk_kits_received: 0,
                pk_members_oriented: 0,
                program1_target: 0,
                program2_name: 'Immunization',
                program2_target: 0,
                program3_name: '',
                program3_target: 0,
                program4_name: '',
                program4_target: 0,
                actual_population: 0,
                projected_population: 0
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-deep-navy text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-deep-navy/20 hover:bg-soft-navy-blue transition-all shrink-0"
          >
            <Plus size={20} />
            Add Barangay
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-charcoal-gray/10 shadow-sm overflow-hidden">
        {error && (
          <div className="p-6 bg-red-50 border-b border-red-100 text-red-600 text-center">
            <p className="font-semibold">Failed to load barangays</p>
            <p className="text-xs font-mono mt-1">{error}</p>
            <button onClick={fetchBarangays} className="mt-2 text-xs underline font-bold">Retry</button>
          </div>
        )}
        <div className="overflow-x-auto">
          {loading && (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-deep-navy mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading barangays...</p>
            </div>
          )}
          {!loading && (
            <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-mint-cream border-b border-charcoal-gray/10">
                <th className="px-6 py-4 text-xs font-semibold text-blue-slate uppercase tracking-wider">Barangay / Municipality</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-slate uppercase tracking-wider">Puroks</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-slate uppercase tracking-wider">PK Teams / Members</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-slate uppercase tracking-wider">Kits / Oriented</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-slate uppercase tracking-wider">Actual / Projected Pop</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-slate uppercase tracking-wider">Targets</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-slate uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-gray/5">
              {barangays.map((b) => (
                <tr key={b.id} className="hover:bg-mint-cream transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-charcoal-gray">{formatBarangay(b.municipality, b.barangay_name)}</div>
                    <div className="text-xs text-blue-slate">{formatMunicipality(b.municipality)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-honeydew rounded-md text-sm font-medium">{b.puroks}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-charcoal-gray">{b.pk_teams} Teams</div>
                    <div className="text-xs text-blue-slate">{b.pk_team_members} Members</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-charcoal-gray">{b.pk_kits_received} Kits</div>
                    <div className="text-xs text-blue-slate">{b.pk_members_oriented} Oriented</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-charcoal-gray">{(b.actual_population || 0).toLocaleString()}</div>
                    <div className="text-xs text-blue-slate">{(b.projected_population || 0).toLocaleString()} Projected</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-deep-navy"></span>
                        <span className="text-blue-slate">Nutrition:</span>
                        <span className="font-bold text-charcoal-gray">{b.program1_target}</span>
                      </div>
                      {b.program2_name && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-steel-blue"></span>
                          <span className="text-blue-slate">{b.program2_name}:</span>
                          <span className="font-bold text-charcoal-gray">{b.program2_target}</span>
                        </div>
                      )}
                      {b.program3_name && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-heritage-yellow"></span>
                          <span className="text-blue-slate">{b.program3_name}:</span>
                          <span className="font-bold text-charcoal-gray">{b.program3_target}</span>
                        </div>
                      )}
                      {b.program4_name && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-soft-navy-blue"></span>
                          <span className="text-blue-slate">{b.program4_name}:</span>
                          <span className="font-bold text-charcoal-gray">{b.program4_target}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {currentUser.role === 'ADMIN' && (
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(b)}
                          className="p-2 text-blue-slate hover:text-deep-navy hover:bg-deep-navy/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(b.id!)}
                          className="p-2 text-blue-slate hover:text-alert-red hover:bg-alert-red/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {barangays.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-blue-slate">
                    No barangays found. Add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>
        <div className="px-6 py-4 border-t border-charcoal-gray/10 flex flex-col md:flex-row items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-4">
            <div className="text-sm text-blue-slate">
              Showing {total === 0 ? 0 : ((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} entries
            </div>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-3 py-1.5 border border-charcoal-gray/10 text-sm font-medium text-charcoal-gray rounded-lg outline-none focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue"
            >
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={500}>500 per page</option>
              <option value={1000}>1000 per page</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 border border-charcoal-gray/10 text-sm font-medium text-charcoal-gray rounded-lg disabled:opacity-50 hover:bg-mint-cream transition-colors"
            >
              Previous
            </button>
            <button 
              disabled={page * limit >= total}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 border border-charcoal-gray/10 text-sm font-medium text-charcoal-gray rounded-lg disabled:opacity-50 hover:bg-mint-cream transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-charcoal-gray/5 flex items-center justify-between">
                <h2 className="text-xl font-bold text-charcoal-gray">{editingId ? 'Edit' : 'Add'} Barangay Profile</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-mint-cream rounded-full text-blue-slate">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-charcoal-gray">Municipality Name</label>
                    <select 
                      className={`w-full px-4 py-2.5 border border-charcoal-gray/10 rounded-xl outline-none transition-all ${
                        currentUser.role === 'MUNICIPALITY' 
                          ? 'bg-honeydew text-blue-slate cursor-not-allowed' 
                          : 'bg-mint-cream focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue'
                      }`}
                      value={formData.municipality}
                      onChange={e => handleMunicipalityChange(e.target.value)}
                      disabled={currentUser.role === 'MUNICIPALITY'}
                      required
                    >
                      <option value="" disabled>Please select municipality</option>
                      {MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-charcoal-gray">Barangay Name</label>
                    <select 
                      className="w-full px-4 py-2.5 bg-mint-cream border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                      value={formData.barangay_name}
                      onChange={e => {
                        const barangayName = e.target.value;
                        const newFormData = {...formData, barangay_name: barangayName};
                        if (!isProgram2Customizable(newFormData.municipality, barangayName)) {
                          newFormData.program2_name = 'Immunization';
                        }
                        setFormData(newFormData);
                      }}
                      required
                      disabled={!formData.municipality}
                    >
                      <option value="" disabled>Please select barangay</option>
                      {formData.municipality && (MUNICIPALITIES_DATA[formData.municipality] || []).map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-blue-slate uppercase tracking-wider">Actual Population</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2.5 bg-mint-cream border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                      value={formData.actual_population}
                      onChange={e => setFormData({...formData, actual_population: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-blue-slate uppercase tracking-wider">Projected Population</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2.5 bg-mint-cream border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                      value={formData.projected_population}
                      onChange={e => setFormData({...formData, projected_population: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-blue-slate uppercase tracking-wider">Total Puroks</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2.5 bg-mint-cream border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                      value={formData.puroks}
                      onChange={e => setFormData({...formData, puroks: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-blue-slate uppercase tracking-wider">PK Teams</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2.5 bg-mint-cream border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                      value={formData.pk_teams}
                      onChange={e => setFormData({...formData, pk_teams: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-blue-slate uppercase tracking-wider">Team Members</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2.5 bg-mint-cream border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                      value={formData.pk_team_members}
                      onChange={e => setFormData({...formData, pk_team_members: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-blue-slate uppercase tracking-wider">Kits Received</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2.5 bg-mint-cream border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                      value={formData.pk_kits_received}
                      onChange={e => setFormData({...formData, pk_kits_received: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-blue-slate uppercase tracking-wider">Members Oriented</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2.5 bg-mint-cream border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                      value={formData.pk_members_oriented}
                      onChange={e => setFormData({...formData, pk_members_oriented: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="p-6 bg-mint-cream rounded-2xl border border-charcoal-gray/5 space-y-6">
                  <h3 className="font-bold text-charcoal-gray flex items-center gap-2">
                    <Package size={18} className="text-deep-navy" />
                    Priority Programs
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-charcoal-gray flex items-center gap-1">
                        Program 1 (Mandatory)
                        <Info size={14} className="text-blue-slate cursor-help" title={PROGRAM_DESCRIPTIONS["Nutrition"]} />
                      </label>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            disabled 
                            value="Nutrition" 
                            className="flex-1 px-4 py-2.5 bg-honeydew border border-charcoal-gray/10 rounded-xl text-blue-slate" 
                          />
                          <input 
                            type="number" 
                            placeholder="Target"
                            className={`w-24 px-4 py-2.5 border border-charcoal-gray/10 rounded-xl outline-none ${
                              currentUser.role !== 'ADMIN' 
                                ? 'bg-honeydew text-blue-slate cursor-not-allowed' 
                                : 'bg-white focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue'
                            }`}
                            value={formData.program1_target}
                            onChange={e => setFormData({...formData, program1_target: parseInt(e.target.value) || 0})}
                            disabled={currentUser.role !== 'ADMIN'}
                          />
                        </div>
                        <span className="text-xs text-blue-slate italic">
                          Target: {PROGRAM_TARGET_DEFINITIONS["Nutrition"]}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-charcoal-gray/5 my-2"></div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-charcoal-gray flex items-center gap-1">
                        Program 2
                        {formData.program2_name && (
                          <Info size={14} className="text-blue-slate cursor-help" title={PROGRAM_DESCRIPTIONS[formData.program2_name]} />
                        )}
                      </label>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-2">
                          <select 
                            className={`flex-1 px-4 py-2.5 bg-white border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none ${!isProgram2Customizable(formData.municipality, formData.barangay_name) ? 'bg-honeydew text-blue-slate cursor-not-allowed' : ''}`}
                            value={formData.program2_name}
                            onChange={e => {
                              const newProgram = e.target.value;
                              setFormData({
                                ...formData, 
                                program2_name: newProgram,
                                program2_target: isNoTargetProgram(newProgram) ? 0 : formData.program2_target
                              });
                            }}
                            disabled={!isProgram2Customizable(formData.municipality, formData.barangay_name)}
                          >
                            <option value="">Select Program</option>
                            {getAvailablePrograms(formData.program2_name).map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <input 
                            type="number" 
                            placeholder="Target"
                            className={`w-24 px-4 py-2.5 border border-charcoal-gray/10 rounded-xl outline-none ${
                              (isNoTargetProgram(formData.program2_name) || (!isProgram2Customizable(formData.municipality, formData.barangay_name) && currentUser.role !== 'ADMIN'))
                                ? 'bg-honeydew text-blue-slate cursor-not-allowed' 
                                : 'bg-white focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue'
                            }`}
                            value={formData.program2_target}
                            onChange={e => setFormData({...formData, program2_target: parseInt(e.target.value) || 0})}
                            disabled={isNoTargetProgram(formData.program2_name) || (!isProgram2Customizable(formData.municipality, formData.barangay_name) && currentUser.role !== 'ADMIN')}
                          />
                        </div>
                        {formData.program2_name && (
                          <span className="text-xs text-blue-slate italic">
                            Target: {PROGRAM_TARGET_DEFINITIONS[formData.program2_name] || "Set target population"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-charcoal-gray flex items-center gap-1">
                        Program 3
                        {formData.program3_name && (
                          <Info size={14} className="text-blue-slate cursor-help" title={PROGRAM_DESCRIPTIONS[formData.program3_name]} />
                        )}
                      </label>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-2">
                          <select 
                            className="flex-1 px-4 py-2.5 bg-white border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                            value={formData.program3_name}
                            onChange={e => {
                              const newProgram = e.target.value;
                              setFormData({
                                ...formData, 
                                program3_name: newProgram,
                                program3_target: isNoTargetProgram(newProgram) ? 0 : formData.program3_target
                              });
                            }}
                          >
                            <option value="">Select Program</option>
                            {getAvailablePrograms(formData.program3_name).map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <input 
                            type="number" 
                            placeholder="Target"
                            className={`w-24 px-4 py-2.5 border border-charcoal-gray/10 rounded-xl outline-none ${
                              isNoTargetProgram(formData.program3_name) 
                                ? 'bg-honeydew text-blue-slate cursor-not-allowed' 
                                : 'bg-white focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue'
                            }`}
                            value={formData.program3_target}
                            onChange={e => setFormData({...formData, program3_target: parseInt(e.target.value) || 0})}
                            disabled={isNoTargetProgram(formData.program3_name)}
                          />
                        </div>
                        {formData.program3_name && (
                          <span className="text-xs text-blue-slate italic">
                            Target: {PROGRAM_TARGET_DEFINITIONS[formData.program3_name] || "Set target population"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-charcoal-gray flex items-center gap-1">
                        Program 4
                        {formData.program4_name && (
                          <Info size={14} className="text-blue-slate cursor-help" title={PROGRAM_DESCRIPTIONS[formData.program4_name]} />
                        )}
                      </label>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-2">
                          <select 
                            className="flex-1 px-4 py-2.5 bg-white border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                            value={formData.program4_name}
                            onChange={e => {
                              const newProgram = e.target.value;
                              setFormData({
                                ...formData, 
                                program4_name: newProgram,
                                program4_target: isNoTargetProgram(newProgram) ? 0 : formData.program4_target
                              });
                            }}
                          >
                            <option value="">Select Program</option>
                            {getAvailablePrograms(formData.program4_name).map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <input 
                            type="number" 
                            placeholder="Target"
                            className={`w-24 px-4 py-2.5 border border-charcoal-gray/10 rounded-xl outline-none ${
                              isNoTargetProgram(formData.program4_name) 
                                ? 'bg-honeydew text-blue-slate cursor-not-allowed' 
                                : 'bg-white focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue'
                            }`}
                            value={formData.program4_target}
                            onChange={e => setFormData({...formData, program4_target: parseInt(e.target.value) || 0})}
                            disabled={isNoTargetProgram(formData.program4_name)}
                          />
                        </div>
                        {formData.program4_name && (
                          <span className="text-xs text-blue-slate italic">
                            Target: {PROGRAM_TARGET_DEFINITIONS[formData.program4_name] || "Set target population"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-charcoal-gray/10 text-blue-slate font-semibold rounded-xl hover:bg-mint-cream transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className={`flex-1 px-6 py-3 bg-deep-navy text-white font-semibold rounded-xl shadow-lg shadow-deep-navy/20 transition-all ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-soft-navy-blue'}`}
                  >
                    {isSaving ? 'Saving...' : (editingId ? 'Update' : 'Save')} Barangay
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

