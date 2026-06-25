import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, Filter, Clock, User, Activity, FileText, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { User as UserType } from '../types';
import { formatMunicipality } from '../constants';

interface AuditLog {
  id: number;
  user_id: string;
  username: string;
  role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
}

interface DataAuditProps {
  currentUser: UserType;
}

export default function DataAudit({ currentUser }: DataAuditProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchLogs();
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [page, actionFilter, entityFilter, searchTerm]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (actionFilter) queryParams.append('action', actionFilter);
      if (entityFilter) queryParams.append('entity_type', entityFilter);
      if (searchTerm) queryParams.append('search', searchTerm);
      
      // If municipality user, only show their municipality's logs
      if (currentUser.role === 'MUNICIPALITY') {
        queryParams.append('username', currentUser.username);
      }

      const res = await fetch(`/api/audit_logs?${queryParams.toString()}`);
      
      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errData = await res.json();
          throw new Error(errData.message || errData.error || `Server error: ${res.status}`);
        } else {
          const text = await res.text();
          if (text.includes('Cookie check') || text.includes('Action required to load your app') || text.includes('__SECURE-aistudio')) {
             window.location.reload();
             return;
          }
          if (text.includes('<!doctype html>')) {
             throw new Error(`Server returned HTML instead of API data. The server might be restarting or taking too long. Please try again later.`);
          }
          throw new Error(`Failed to fetch audit logs: ${res.statusText}\n${text.substring(0, 100)}`);
        }
      }

      const contentType = res.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        const text = await res.text();
        throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
      }
      
      const { data, total } = await res.json();
      setLogs(data || []);
      if (total) {
        setTotalPages(Math.ceil(total / limit));
      }
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      setError(err.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action.toUpperCase()) {
      case 'CREATE': return 'bg-green-100 text-green-700 border-green-200';
      case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'DELETE': return 'bg-red-100 text-red-700 border-red-200';
      case 'LOGIN': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const renderDetails = (details: any) => {
    if (!details) return null;
    
    // If it's a string, just return it
    if (typeof details === 'string') return <span className="text-gray-600">{details}</span>;
    
    // If it's an object with specific fields we care about
    if (details.full_name) {
      return (
        <div className="text-sm">
          <span className="font-medium text-gray-900">{details.full_name}</span>
          {details.municipality && <span className="text-gray-500 ml-2">({formatMunicipality(details.municipality)})</span>}
        </div>
      );
    }
    
    // Fallback for other objects
    return (
      <div className="text-xs text-gray-500 font-mono truncate max-w-xs">
        {JSON.stringify(details)}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#111827]">Data Audit Logs</h2>
          <p className="text-[#6B7280] text-sm mt-1">Track system activities and data modifications</p>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="text-red-800 font-bold text-lg mb-1">Error Loading Audit Logs</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden flex flex-col h-[calc(100vh-12rem)]">
          {/* Filters Bar */}
          <div className="p-4 border-b border-[#E5E7EB] bg-gray-50/50 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by user or patient name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#005A9C]/20 focus:border-[#005A9C] outline-none text-sm"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#005A9C]/20 focus:border-[#005A9C] outline-none text-sm text-gray-700"
              >
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="LOGIN">Login</option>
              </select>
              
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#005A9C]/20 focus:border-[#005A9C] outline-none text-sm text-gray-700"
              >
                <option value="">All Entities</option>
                <option value="patient">Patient</option>
                <option value="barangay">Barangay</option>
                <option value="user">User</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Date & Time</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">User</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Action</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Entity</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-4 border-[#005A9C]/20 border-t-[#005A9C] rounded-full animate-spin mb-4"></div>
                        <p>Loading audit logs...</p>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <FileText size={48} className="text-gray-300 mb-4" />
                        <p className="text-lg font-medium text-gray-900 mb-1">No logs found</p>
                        <p className="text-sm">Try adjusting your filters or search term</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock size={14} className="text-gray-400" />
                          {formatDate(log.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                            {log.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{log.username}</div>
                            <div className="text-[10px] text-gray-500 uppercase">{log.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 capitalize">
                          {log.entity_type === 'patient' && <User size={14} className="text-blue-500" />}
                          {log.entity_type === 'barangay' && <Activity size={14} className="text-green-500" />}
                          {log.entity_type}
                          {log.entity_id && <span className="text-gray-400 text-xs font-normal ml-1">#{log.entity_id}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {renderDetails(log.details)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && logs.length > 0 && (
            <div className="p-4 border-t border-[#E5E7EB] bg-white flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-900">{(page - 1) * limit + 1}</span> to <span className="font-medium text-gray-900">{Math.min(page * limit, (page - 1) * limit + logs.length)}</span> entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <div className="text-sm font-medium text-gray-700">
                  Page {page} of {totalPages}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={20} className="text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
