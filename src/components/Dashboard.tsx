import React, { useState, useEffect, useRef } from 'react';
import { Users, Target, Activity, ClipboardCheck, Share2, ArrowUpRight, Home, TrendingUp, Download, Copy, Check } from 'lucide-react';
import { DashboardStats, User } from '../types';
import { MUNICIPALITIES, MUNICIPALITIES_DATA, formatMunicipality } from '../constants';
import IlocosSurMap from './IlocosSurMap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toPng, toBlob } from 'html-to-image';

const GroupCard = ({ title, icon: Icon, children, id, className = "", headerAction }: { title: string, icon: any, children: React.ReactNode, id: string, className?: string, headerAction?: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const prepareElement = (element: HTMLElement) => {
    // Set downloading attribute to allow CSS-based changes
    element.setAttribute('data-downloading', 'true');
    
    // Find elements that should be hidden during download
    const toHide = element.querySelectorAll('[data-downloading-hide="true"]');
    toHide.forEach(el => (el as HTMLElement).style.display = 'none');

    // Find all potential clipping containers including absolute ones
    const containers = element.querySelectorAll('.overflow-y-auto, .overflow-auto, .overflow-x-auto, .absolute.inset-0, .flex-grow');
    const originalStates = Array.from(containers).map(el => {
      const style = (el as HTMLElement).style;
      return {
        el: el as HTMLElement,
        maxHeight: style.maxHeight,
        maxWidth: style.maxWidth,
        overflowY: style.overflowY,
        overflowX: style.overflowX,
        height: style.height,
        width: style.width,
        position: style.position,
        flexGrow: style.flexGrow
      };
    });

    // Temporarily expand all containers to their full size and hide scrollbars
    originalStates.forEach(state => {
      state.el.style.maxHeight = 'none';
      state.el.style.maxWidth = 'none';
      state.el.style.overflowY = 'visible';
      state.el.style.overflowX = 'visible';
      state.el.style.height = 'auto';
      state.el.style.width = 'auto';
      
      // Handle absolute positioning which often clips content in exports
      if (state.el.classList.contains('absolute')) {
        state.el.style.position = 'relative';
      }
      
      // Disable flex-grow to allow natural content-based height
      if (state.el.classList.contains('flex-grow')) {
        state.el.style.flexGrow = '0';
      }
    });

    return { element, originalStates };
  };

  const restoreElement = (element: HTMLElement, originalStates: any[]) => {
    // Restore elements that were hidden
    const toHide = element.querySelectorAll('[data-downloading-hide="true"]');
    toHide.forEach(el => (el as HTMLElement).style.display = '');

    // Restore original states
    originalStates.forEach(state => {
      state.el.style.maxHeight = state.maxHeight;
      state.el.style.maxWidth = state.maxWidth;
      state.el.style.overflowY = state.overflowY;
      state.el.style.overflowX = state.overflowX;
      state.el.style.height = state.height;
      state.el.style.width = state.width;
      state.el.style.position = state.position;
      state.el.style.flexGrow = state.flexGrow;
    });
    element.removeAttribute('data-downloading');
  };

  const download = async () => {
    if (ref.current) {
      const { element, originalStates } = prepareElement(ref.current);
      
      try {
        // Wait a frame for the browser to recalculate layout
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        const dataUrl = await toPng(element, { 
          cacheBust: true, 
          backgroundColor: '#ffffff',
          pixelRatio: 3, // High resolution for Word/Print
          // Ensure the captured container itself is treated as auto-size
          style: {
            height: 'auto',
            maxHeight: 'none',
            width: 'auto',
            maxWidth: 'none'
          }
        });

        const link = document.createElement('a');
        link.download = `${title.replace(/\s+/g, '_').toLowerCase()}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Export failed:', err);
      } finally {
        restoreElement(element, originalStates);
      }
    }
  };

  const copyToClipboard = async () => {
    if (ref.current) {
      const { element, originalStates } = prepareElement(ref.current);
      
      try {
        // Wait a frame for the browser to recalculate layout
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        const blob = await toBlob(element, { 
          cacheBust: true, 
          backgroundColor: '#ffffff',
          pixelRatio: 3, // High resolution for Word/Print
          style: {
            height: 'auto',
            maxHeight: 'none',
            width: 'auto',
            maxWidth: 'none'
          }
        });

        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } catch (err) {
        console.error('Copy failed:', err);
      } finally {
        restoreElement(element, originalStates);
      }
    }
  };

  return (
    <div className={`space-y-4 h-full flex flex-col`} id={id}>
      <div className="flex justify-end items-center gap-4">
        <button 
          onClick={copyToClipboard} 
          className="flex items-center gap-1 text-[10px] text-deep-navy hover:text-soft-navy-blue font-black uppercase tracking-wider transition-colors"
          title="Copy high-resolution image to clipboard"
        >
          {copied ? (
            <>
              <Check size={12} className="text-green-600" /> 
              <span className="text-green-600">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={12} /> Copy to Clipboard
            </>
          )}
        </button>
        <button 
          onClick={download} 
          className="flex items-center gap-1 text-[10px] text-deep-navy hover:text-soft-navy-blue font-black uppercase tracking-wider transition-colors"
          title="Download high-resolution PNG"
        >
          <Download size={12} /> Download PNG
        </button>
        {headerAction && (
          <div className="ml-2 pl-4 border-l border-gray-200 flex items-center">
            {headerAction}
          </div>
        )}
      </div>
      <div className={`bg-gradient-to-br from-white to-honeydew p-6 rounded-2xl border border-charcoal-gray/10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] transition-all duration-300 flex-grow flex flex-col ${className}`} ref={ref}>
        <div className="flex items-center gap-3 mb-6 shrink-0">
          <div className="p-2.5 rounded-xl bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] border border-charcoal-gray/10 text-deep-navy">
            <Icon size={22} strokeWidth={2.5} />
          </div>
          <h3 className="text-lg font-black text-charcoal-gray tracking-tight uppercase flex-grow">{title}</h3>
          <img src="/purokalusugan-logo.png" alt="PuroKalusugan Logo" className="h-8 md:h-10 object-contain" referrerPolicy="no-referrer" />
        </div>
        <div className="flex-grow flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
};

interface DashboardProps {
  currentUser: User;
}

export default function Dashboard({ currentUser }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalTarget: 0,
    totalServed: 0,
    totalPopulationReached: 0,
    totalHealthPromotion: 0,
    totalFPE: 0,
    totalPhilHealth: 0,
    totalReferral: 0,
    totalWashTarget: 0,
    totalWashServed: 0,
    municipalityStats: [],
    totalPuroks: 0,
    totalPKTeams: 0,
    totalPKTeamMembers: 0,
    totalPKKitsReceived: 0,
    totalPKMembersOriented: 0,
    totalLargeScaleClientsServed: 0,
    largeScaleProgramCounts: {},
    priorityProgramStats: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMunicipality, setSelectedMunicipality] = useState<string>(() => {
    if (currentUser.role === 'MUNICIPALITY') {
      return currentUser.municipality;
    }
    const saved = localStorage.getItem('dashboard_municipality');
    return saved || '';
  });
  const [selectedBarangay, setSelectedBarangay] = useState<string>(() => localStorage.getItem('dashboard_barangay') || '');
  const [selectedYear, setSelectedYear] = useState<string>(() => localStorage.getItem('dashboard_year') || new Date().getFullYear().toString());
  const [selectedQuarter, setSelectedQuarter] = useState<string>(() => localStorage.getItem('dashboard_quarter') || '');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => localStorage.getItem('dashboard_month') || '');
  const [selectedWeek, setSelectedWeek] = useState<string>(() => localStorage.getItem('dashboard_week') || '');
  const [activeTab, setActiveTab] = useState<'overview' | 'operational' | 'geographic'>('overview');

  useEffect(() => {
    localStorage.setItem('dashboard_municipality', selectedMunicipality);
    localStorage.setItem('dashboard_barangay', selectedBarangay);
    localStorage.setItem('dashboard_year', selectedYear);
    localStorage.setItem('dashboard_quarter', selectedQuarter);
    localStorage.setItem('dashboard_month', selectedMonth);
    localStorage.setItem('dashboard_week', selectedWeek);
  }, [selectedMunicipality, selectedBarangay, selectedYear, selectedQuarter, selectedMonth, selectedWeek]);

  const getAccomplishmentColor = (percentage: number, hasTarget: boolean) => {
    if (!hasTarget) return 'bg-slate-100 text-slate-400';
    if (percentage >= 100) return 'bg-[#064E3B] text-white';
    if (percentage >= 75) return 'bg-[#4ADE80] text-[#064E3B]';
    if (percentage >= 50) return 'bg-[#FBBF24] text-[#78350F]';
    if (percentage >= 25) return 'bg-[#FB923C] text-[#7C2D12]';
    return 'bg-[#F87171] text-[#7F1D1D]';
  };

  const fetchData = async (isRefresh: boolean = false) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (selectedMunicipality) params.append('municipality', selectedMunicipality);
    if (selectedBarangay) params.append('barangay', selectedBarangay);
    if (selectedYear) params.append('year', selectedYear);
    if (selectedQuarter) params.append('quarter', selectedQuarter);
    if (selectedMonth) params.append('month', selectedMonth);
    if (selectedWeek) params.append('week', selectedWeek);
    if (isRefresh === true) {
      params.append('refresh', 'true');
    }
    
    const url = `/api/stats?${params.toString()}`;
    
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errData = await res.json();
          throw new Error(errData.message || errData.error || `Server error: ${res.status}`);
        } else {
          const text = await res.text();
          if (text.includes('<!doctype html>')) {
            throw new Error(`Server timeout. The backend took too long to respond. The database is likely overwhelmed. Please execute the updated SQL script found in "supabase_schema.sql" in your Supabase SQL Editor to optimize queries.`);
          }
          throw new Error(`Server error: ${res.status} ${res.statusText}\n${text.substring(0, 100)}`);
        }
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        const text = await res.text();
        if (text.includes('Cookie check') || text.includes('Action required to load your app') || text.includes('__SECURE-aistudio')) {
           window.location.reload();
           return;
        }
        if (text.includes('<!doctype html>')) {
           throw new Error(`Server timeout. The backend took too long to respond. The database is likely overwhelmed. Please execute the updated SQL script found in "supabase_schema.sql" in your Supabase SQL Editor to optimize queries.`);
        }
        throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
      }
      const data = await res.json();
      console.log("Fetched stats:", data);
      setStats(data);
    } catch (err: any) {
      console.error("Error fetching stats:", err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const downloadBarangayStats = () => {
    if (!stats.barangayStats || stats.barangayStats.length === 0) return;

    // Define the headers
    const headers = [
      'Municipality',
      'Barangay',
      // Group 1: PuroKalusugan Program Accomplishment
      'Total Clients Target',
      'Total Clients Served',
      'Client Coverage (%)',
      'Total Household (WASH) Target',
      'Total Household (WASH) Served',
      'Household Coverage (%)',
      'Total Coverage (%)',
      // Priority Programs
      'Nutrition Target', 'Nutrition Served', 'Nutrition Coverage (%)',
      'Cancer Target', 'Cancer Served', 'Cancer Coverage (%)',
      'Immunization Target', 'Immunization Served', 'Immunization Coverage (%)',
      'HPN Target', 'HPN Served', 'HPN Coverage (%)',
      'DM Target', 'DM Served', 'DM Coverage (%)',
      'Maternal Health Target', 'Maternal Health Served', 'Maternal Health Coverage (%)',
      'Road Safety Target', 'Road Safety Served', 'Road Safety Coverage (%)',
      'Mental Health Target', 'Mental Health Served', 'Mental Health Coverage (%)',
      'TB Target', 'TB Served', 'TB Coverage (%)',
      'HIV Target', 'HIV Served', 'HIV Coverage (%)',
      // Group 2: PuroKalusugan Primary Health Care
      'Total Health Promotion',
      'Total Community-Base (PK) FPE',
      'Total Community-Base (PK) PhilHealth',
      'Total Referral',
      // Group 3: PuroKalusugan Large Scale Activities
      'Total PK Activity Days',
      'Large Scale Activity Days',
      'Total Patients Served (Large Scale)',
      'Total Priority Large Scale Patients',
      'LS Nutrition', 'LS Cancer', 'LS Immunization', 'LS HPN', 'LS DM',
      'LS Maternal Health', 'LS Road Safety', 'LS Mental Health', 'LS TB', 'LS HIV',
      'LS WASH', 'LS Health Promotion', 'LS FPE', 'LS PhilHealth', 'LS Referral',
      // Group 4: PuroKalusugan Teams
      'Total Puroks',
      'Total PK Teams',
      'Total PK Team Members',
      'Total PK Kits Received',
      'Total PK Members Oriented'
    ];

    // Create CSV rows
    const rows = stats.barangayStats.map(b => {
      const pStats = b.priorityProgramStats || {};
      return [
        formatMunicipality(b.municipality),
        b.barangay,
        // Group 1
        b.target || 0,
        b.served || 0,
        Math.round(b.percentage || 0),
        b.householdsTarget || 0,
        b.householdsServed || 0,
        Math.round(b.householdsPercentage || 0),
        Math.round(b.totalPercentage || 0),
        // Priority Programs
        pStats['Nutrition']?.target || 0, pStats['Nutrition']?.served || 0, Math.round(pStats['Nutrition']?.percentage || 0),
        pStats['Cancer']?.target || 0, pStats['Cancer']?.served || 0, Math.round(pStats['Cancer']?.percentage || 0),
        pStats['Immunization']?.target || 0, pStats['Immunization']?.served || 0, Math.round(pStats['Immunization']?.percentage || 0),
        pStats['HPN']?.target || 0, pStats['HPN']?.served || 0, Math.round(pStats['HPN']?.percentage || 0),
        pStats['DM']?.target || 0, pStats['DM']?.served || 0, Math.round(pStats['DM']?.percentage || 0),
        pStats['Maternal Health']?.target || 0, pStats['Maternal Health']?.served || 0, Math.round(pStats['Maternal Health']?.percentage || 0),
        pStats['Road Safety']?.target || 0, pStats['Road Safety']?.served || 0, Math.round(pStats['Road Safety']?.percentage || 0),
        pStats['Mental Health']?.target || 0, pStats['Mental Health']?.served || 0, Math.round(pStats['Mental Health']?.percentage || 0),
        pStats['TB']?.target || 0, pStats['TB']?.served || 0, Math.round(pStats['TB']?.percentage || 0),
        pStats['HIV']?.target || 0, pStats['HIV']?.served || 0, Math.round(pStats['HIV']?.percentage || 0),
        // Group 2
        b.healthPromotion || 0,
        b.fpe || 0,
        b.philhealth || 0,
        b.referral || 0,
        // Group 3
        b.pkActivities || 0,
        b.largeScaleActivities || 0,
        b.totalLargeScaleClientsServed || 0,
        b.totalPriorityLargeScalePatients || 0,
        b.ls_nutrition || 0, b.ls_cancer || 0, b.ls_immunization || 0, b.ls_hpn || 0, b.ls_dm || 0,
        b.ls_maternal_health || 0, b.ls_road_safety || 0, b.ls_mental_health || 0, b.ls_tb || 0, b.ls_hiv || 0,
        b.ls_wash || 0, b.ls_health_promotion || 0, b.ls_fpe || 0, b.ls_philhealth || 0, b.ls_referral || 0,
        // Group 4
        b.puroks || 0,
        b.pkTeams || 0,
        b.pkTeamMembers || 0,
        b.pkKitsReceived || 0,
        b.pkMembersOriented || 0
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create a Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `barangay_stats_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchData();
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [selectedMunicipality, selectedBarangay, selectedYear, selectedQuarter, selectedMonth, selectedWeek]);

  const availableBarangays = selectedMunicipality ? MUNICIPALITIES_DATA[selectedMunicipality] || [] : [];

  const cards = [
    { label: 'Total Clients Target', value: stats.totalTarget, icon: Target, color: 'bg-health-blue/10 text-health-blue', border: 'border-health-blue/20' },
    { 
      label: 'Total Clients Served', 
      value: stats.totalServed, 
      icon: Users, 
      color: 'bg-deep-navy/10 text-deep-navy', 
      border: 'border-deep-navy/20',
      percentage: stats.totalTarget > 0 ? Math.round((stats.totalServed / stats.totalTarget) * 100) : 0
    },
    { label: 'Total Household (WASH) Target', value: stats.totalWashTarget, icon: Home, color: 'bg-soft-navy-blue/10 text-soft-navy-blue', border: 'border-soft-navy-blue/20' },
    { 
      label: 'Total Household (WASH) Served', 
      value: stats.totalWashServed, 
      icon: ClipboardCheck, 
      color: 'bg-blue-slate/10 text-blue-slate', 
      border: 'border-blue-slate/20',
      percentage: stats.totalWashTarget > 0 ? Math.round((stats.totalWashServed / stats.totalWashTarget) * 100) : 0
    },
  ];

  const secondaryCards = [
    { label: 'Total Health Promotion', value: stats.totalHealthPromotion, icon: Activity, color: 'bg-purple-50 text-purple-600', border: 'border-purple-100' },
    { label: 'Total Community-Base (PK) FPE', value: stats.totalFPE, icon: ClipboardCheck, color: 'bg-orange-50 text-orange-600', border: 'border-orange-100' },
    { label: 'Total Community-Base (PK) PhilHealth', value: stats.totalPhilHealth, icon: Share2, color: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-100' },
    { label: 'Total Referral', value: stats.totalReferral, icon: ArrowUpRight, color: 'bg-rose-50 text-rose-600', border: 'border-rose-100' },
    { label: 'Total PK Activities', value: stats.totalPKActivities || 0, icon: Activity, color: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-100' },
    
    // New Cards
    { label: 'Total Puroks', value: stats.totalPuroks || 0, icon: Home, color: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-100' },
    { label: 'Total PK Teams', value: stats.totalPKTeams || 0, icon: Users, color: 'bg-pink-50 text-pink-600', border: 'border-pink-100' },
    { label: 'Total PK Team Members', value: stats.totalPKTeamMembers || 0, icon: Users, color: 'bg-teal-50 text-teal-600', border: 'border-teal-100' },
    { label: 'Total PK Kits Received', value: stats.totalPKKitsReceived || 0, icon: ClipboardCheck, color: 'bg-lime-50 text-lime-600', border: 'border-lime-100' },
    { label: 'Total PK Teams Oriented', value: stats.totalPKMembersOriented || 0, icon: Users, color: 'bg-sky-50 text-sky-600', border: 'border-sky-100' },
    { label: 'Total PK Large Scale Patients', value: stats.totalPKLargeScalePatients || 0, icon: Users, color: 'bg-amber-50 text-amber-600', border: 'border-amber-100' },
    { label: 'Total Priority Large Scale Patients', value: stats.totalPriorityLargeScalePatients || 0, icon: Users, color: 'bg-orange-50 text-orange-600', border: 'border-orange-100' },
  ];

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.append('year', selectedYear);
      if (selectedQuarter) params.append('quarter', selectedQuarter);
      if (selectedMonth) params.append('month', selectedMonth);
      if (selectedWeek) params.append('week', selectedWeek);
      
      const res = await fetch(`/api/export-coverage?${params.toString()}`);
      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errData = await res.json();
          throw new Error(errData.message || errData.error || 'Failed to export coverage data');
        } else {
          const text = await res.text();
          if (text.includes('<!doctype html>')) {
            throw new Error(`Export failed due to server timeout. Please execute the updated SQL script found in "supabase_schema.sql" in your Supabase SQL Editor to optimize queries.`);
          }
          throw new Error('Failed to export coverage data');
        }
      }
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") === -1 && contentType.indexOf("text/csv") === -1) {
        const text = await res.text();
        if (text.includes('Cookie check') || text.includes('Action required to load your app') || text.includes('__SECURE-aistudio')) {
           window.location.reload();
           return;
        }
        if (text.includes('<!doctype html>')) {
           throw new Error(`Export failed due to server timeout. Please execute the updated SQL script found in "supabase_schema.sql" in your Supabase SQL Editor to optimize queries.`);
        }
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'municipality_coverage.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting data:', err);
      alert('Failed to output CSV data.');
    }
  };

  const exportAction = (
    <button 
      onClick={handleExport}
      className="flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-900 font-black uppercase tracking-wider transition-colors bg-emerald-50 px-3 py-1.5 rounded-md hover:bg-emerald-100 cursor-pointer"
      title="Download per-municipality population coverage as CSV"
    >
      <Download size={12} /> Export CSV
    </button>
  );

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="bg-gradient-to-br from-white to-honeydew p-6 rounded-2xl border border-charcoal-gray/10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-4">
        {/* Time Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-2">
            <label className="text-xs font-bold text-charcoal-gray uppercase tracking-wider">Year</label>
            <select 
              className="w-full px-4 py-2.5 bg-mint-cream border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">All Years</option>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-xs font-bold text-charcoal-gray uppercase tracking-wider">Quarter</label>
            <select 
              className="w-full px-4 py-2.5 bg-mint-cream border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
              value={selectedQuarter}
              onChange={(e) => {
                setSelectedQuarter(e.target.value);
                if (e.target.value) {
                  setSelectedMonth('');
                  setSelectedWeek('');
                }
              }}
            >
              <option value="">All Quarters</option>
              <option value="1">Q1 (Jan - Mar)</option>
              <option value="2">Q2 (Apr - Jun)</option>
              <option value="3">Q3 (Jul - Sep)</option>
              <option value="4">Q4 (Oct - Dec)</option>
            </select>
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-xs font-bold text-charcoal-gray uppercase tracking-wider">Month</label>
            <select 
              className="w-full px-4 py-2.5 bg-mint-cream border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                if (e.target.value) {
                  setSelectedQuarter('');
                  setSelectedWeek('');
                }
              }}
            >
              <option value="">All Months</option>
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-xs font-bold text-charcoal-gray uppercase tracking-wider">Week</label>
            <select 
              className="w-full px-4 py-2.5 bg-mint-cream border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
              value={selectedWeek}
              onChange={(e) => {
                setSelectedWeek(e.target.value);
                if (e.target.value) {
                  setSelectedQuarter('');
                  setSelectedMonth('');
                }
              }}
            >
              <option value="">All Weeks</option>
              {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Location Filters */}
        <div className="flex flex-col md:flex-row items-end gap-4 border-t border-charcoal-gray/10 pt-4">
          {(currentUser.role === 'ADMIN' || currentUser.role === 'VIEWER') && (
            <div className="flex-1 space-y-2 w-full">
              <label className="text-xs font-bold text-charcoal-gray uppercase tracking-wider">Filter Municipality</label>
              <select 
                className="w-full px-4 py-2.5 bg-mint-cream border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                value={selectedMunicipality}
                onChange={(e) => {
                  setSelectedMunicipality(e.target.value);
                  setSelectedBarangay('');
                }}
              >
                <option value="">All Municipalities</option>
                {MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
          
          <div className="flex-1 space-y-2 w-full">
            <label className="text-xs font-bold text-charcoal-gray uppercase tracking-wider">Filter Barangay</label>
            <select 
              className={`w-full px-4 py-2.5 border border-charcoal-gray/10 rounded-xl outline-none transition-all ${
                !selectedMunicipality ? 'bg-charcoal-gray/10 cursor-not-allowed' : 'bg-mint-cream focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue'
              }`}
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              disabled={!selectedMunicipality}
            >
              <option value="">All Barangays</option>
              {availableBarangays.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <button 
            onClick={() => {
              if (currentUser.role === 'ADMIN' || currentUser.role === 'VIEWER') setSelectedMunicipality('');
              setSelectedBarangay('');
              setSelectedYear(new Date().getFullYear().toString());
              setSelectedQuarter('');
              setSelectedMonth('');
              setSelectedWeek('');
            }}
            className="px-6 py-2.5 text-sm font-semibold text-blue-slate hover:text-charcoal-gray transition-colors whitespace-nowrap"
          >
            Reset Filters
          </button>
          <button 
            onClick={() => fetchData(true)}
            className="px-6 py-2.5 text-sm font-semibold text-deep-navy hover:text-soft-navy-blue transition-colors whitespace-nowrap border border-deep-navy rounded-xl"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-deep-navy"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 text-center">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
          <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-100 rounded-lg hover:bg-red-200">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 bg-gradient-to-br from-white to-honeydew p-2 rounded-2xl border border-charcoal-gray/10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] w-full">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`flex-1 min-w-[120px] px-6 py-3 text-sm font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${activeTab === 'overview' ? 'bg-deep-navy text-white shadow-md' : 'text-blue-slate hover:bg-mint-cream hover:text-deep-navy'}`}
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab('operational')}
              className={`flex-1 min-w-[120px] px-6 py-3 text-sm font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${activeTab === 'operational' ? 'bg-deep-navy text-white shadow-md' : 'text-blue-slate hover:bg-mint-cream hover:text-deep-navy'}`}
            >
              Operational Metrics
            </button>
            <button 
              onClick={() => setActiveTab('geographic')}
              className={`flex-1 min-w-[120px] px-6 py-3 text-sm font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${activeTab === 'geographic' ? 'bg-deep-navy text-white shadow-md' : 'text-blue-slate hover:bg-mint-cream hover:text-deep-navy'}`}
            >
              Geographical Data
            </button>
          </div>
          
          {/* SLIDE 1: High-Level Impact */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" id="slide-1">
            <GroupCard title="Population & Coverage Overview" icon={Users} id="population-overview" headerAction={exportAction}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-white to-blue-50/30 p-4 rounded-xl border border-blue-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300">
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">No. of Municipalities</div>
                  <div className="text-2xl font-black text-[#111827] tracking-tight">{stats.totalMunicipalities?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-gradient-to-br from-white to-indigo-50/30 p-4 rounded-xl border border-indigo-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300">
                  <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">No. of Target Barangays</div>
                  <div className="text-2xl font-black text-[#111827] tracking-tight">{stats.totalTargetBarangays?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-gradient-to-br from-white to-purple-50/30 p-4 rounded-xl border border-purple-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300">
                  <div className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Actual Population</div>
                  <div className="text-2xl font-black text-[#111827] tracking-tight">{stats.actualPopulation?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-gradient-to-br from-white to-emerald-50/30 p-4 rounded-xl border border-emerald-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300">
                  <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Population Reached</div>
                  <div className="text-2xl font-black text-[#111827] tracking-tight">{stats.totalPopulationReached?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-gradient-to-br from-white to-amber-50/30 p-4 rounded-xl border border-amber-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300">
                  <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Coverage</div>
                  <div className="text-2xl font-black text-[#111827] tracking-tight">
                    {stats.actualPopulation ? ((stats.totalPopulationReached / stats.actualPopulation) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>
            </GroupCard>

            <GroupCard title="PuroKalusugan Teams" icon={Users} id="purokalusugan-teams">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-gradient-to-br from-white to-indigo-50/30 p-3 rounded-xl border border-indigo-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600 shadow-inner group-hover:scale-110 transition-transform duration-300"><Home size={16} /></div>
                  </div>
                  <div>
                    <div className="text-xl font-black text-[#111827] mb-0.5 tracking-tight">{stats.totalPuroks?.toLocaleString() || 0}</div>
                    <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider leading-tight">Total Puroks</div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-white to-pink-50/30 p-3 rounded-xl border border-pink-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-1.5 rounded-lg bg-pink-100 text-pink-600 shadow-inner group-hover:scale-110 transition-transform duration-300"><Users size={16} /></div>
                  </div>
                  <div>
                    <div className="text-xl font-black text-[#111827] mb-0.5 tracking-tight">{stats.totalPKTeams?.toLocaleString() || 0}</div>
                    <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider leading-tight">Total PK Teams</div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-white to-teal-50/30 p-3 rounded-xl border border-teal-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-1.5 rounded-lg bg-teal-100 text-teal-600 shadow-inner group-hover:scale-110 transition-transform duration-300"><Users size={16} /></div>
                  </div>
                  <div>
                    <div className="text-xl font-black text-[#111827] mb-0.5 tracking-tight">{stats.totalPKTeamMembers?.toLocaleString() || 0}</div>
                    <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider leading-tight">PK Team Members</div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-white to-lime-50/30 p-3 rounded-xl border border-lime-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-1.5 rounded-lg bg-lime-100 text-lime-600 shadow-inner group-hover:scale-110 transition-transform duration-300"><ClipboardCheck size={16} /></div>
                  </div>
                  <div>
                    <div className="text-xl font-black text-[#111827] mb-0.5 tracking-tight">{stats.totalPKKitsReceived?.toLocaleString() || 0}</div>
                    <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider leading-tight">PK Kits Received</div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-white to-sky-50/30 p-3 rounded-xl border border-sky-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-1.5 rounded-lg bg-sky-100 text-sky-600 shadow-inner group-hover:scale-110 transition-transform duration-300"><Users size={16} /></div>
                  </div>
                  <div>
                    <div className="text-xl font-black text-[#111827] mb-0.5 tracking-tight">{stats.totalPKMembersOriented?.toLocaleString() || 0}</div>
                    <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider leading-tight">PK Teams Oriented</div>
                  </div>
                </div>
              </div>
            </GroupCard>

            <GroupCard title="PuroKalusugan Program Accomplishment" icon={Activity} id="program-accomplishment">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {cards.map((card, idx) => (
                  <div 
                    key={idx} 
                    className={`bg-gradient-to-br from-white to-[#F9FAFB] p-3 rounded-xl border ${card.border} shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 group`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className={`p-1.5 rounded-lg ${card.color} shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                        <card.icon size={16} />
                      </div>
                      {card.percentage !== undefined && (
                        <div className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm ${getAccomplishmentColor(card.percentage, true)}`}>
                          {card.percentage}%
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xl font-black text-[#111827] mb-0.5 tracking-tight">{card?.value?.toLocaleString() || 0}</div>
                      <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider leading-tight">{card.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              <h4 className="text-sm font-semibold text-[#374151] mb-3 uppercase tracking-wider">Priority Program Accomplishment</h4>
              {stats.priorityProgramStats && Object.keys(stats.priorityProgramStats).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {Object.entries(stats.priorityProgramStats).map(([program, stat]: [string, any]) => (
                    <div key={program} className="bg-gradient-to-br from-white to-honeydew p-3 rounded-xl border border-gray-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 group">
                      <div className="flex justify-between items-start mb-1">
                        <div className="text-sm font-black text-charcoal-gray tracking-tight">{program}</div>
                        <div className={`text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm ${getAccomplishmentColor(stat.percentage, stat.target > 0)}`}>
                          {Math.round(stat.percentage)}%
                        </div>
                      </div>
                      <div className="flex justify-between items-end mt-1">
                        <div>
                          <div className="text-[10px] font-bold text-blue-slate uppercase tracking-wider">Target</div>
                          <div className="text-base font-black text-charcoal-gray tracking-tight">{stat?.target?.toLocaleString() || 0}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-blue-slate uppercase tracking-wider">Served</div>
                          <div className="text-base font-black text-deep-navy tracking-tight">{stat?.served?.toLocaleString() || 0}</div>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-mint-cream rounded-full h-1.5 mt-2 shadow-inner overflow-hidden">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(0,0,0,0.1)] ${
                            stat.percentage >= 100 ? 'bg-deep-navy' : 
                            stat.percentage >= 50 ? 'bg-heritage-yellow' : 
                            'bg-alert-red'
                          }`} 
                          style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-xl border border-gray-100">
                  No priority program data available for the selected filters.
                </div>
              )}
            </GroupCard>
          </div>
          )}

          {/* SLIDE 2: Operational Metrics */}
          {activeTab === 'operational' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" id="slide-2">
            
            {/* Group 2: PuroKalusugan Primary Health Care */}
            <GroupCard title="PuroKalusugan Primary Health Care" icon={ClipboardCheck} id="primary-health">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-white to-purple-50/30 p-3 rounded-xl border border-purple-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 group">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 shadow-inner group-hover:rotate-12 transition-transform duration-300"><Activity size={16} /></div>
                    <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider leading-tight">Total Health Promotion</div>
                  </div>
                  <div className="text-xl font-black text-[#111827] tracking-tight">{stats.totalHealthPromotion?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-gradient-to-br from-white to-orange-50/30 p-3 rounded-xl border border-orange-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 group">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600 shadow-inner group-hover:rotate-12 transition-transform duration-300"><ClipboardCheck size={16} /></div>
                    <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider leading-tight">Total Community-Based (PK) FPE</div>
                  </div>
                  <div className="text-xl font-black text-[#111827] tracking-tight">{stats.totalFPE?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-gradient-to-br from-white to-cyan-50/30 p-3 rounded-xl border border-cyan-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 group">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600 shadow-inner group-hover:rotate-12 transition-transform duration-300"><Share2 size={16} /></div>
                    <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider leading-tight">Total Community-Based (PK) PhilHealth</div>
                  </div>
                  <div className="text-xl font-black text-[#111827] tracking-tight">{stats.totalPhilHealth?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-gradient-to-br from-white to-rose-50/30 p-3 rounded-xl border border-rose-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 group">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 shadow-inner group-hover:rotate-12 transition-transform duration-300"><ArrowUpRight size={16} /></div>
                    <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider leading-tight">Total Referral</div>
                  </div>
                  <div className="text-xl font-black text-[#111827] tracking-tight">{stats.totalReferral?.toLocaleString() || 0}</div>
                </div>
              </div>
            </GroupCard>
            
            {/* Group 3: PuroKalusugan Large Scale Activities */}
            <GroupCard title="PuroKalusugan Large Scale Activities" icon={Users} id="large-scale-activities">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gradient-to-br from-emerald-50 to-white p-3 rounded-xl border border-emerald-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Total PK Activity Days</div>
                  <div className="text-xl font-black text-deep-navy tracking-tight">{stats.totalPKActivities?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-white p-3 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Large Scale Activity Days</div>
                  <div className="text-xl font-black text-deep-navy tracking-tight">{stats.totalLargeScaleActivities?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-white p-3 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Total Patients Served (Large Scale)</div>
                  <div className="text-xl font-black text-deep-navy tracking-tight">{stats.totalLargeScaleClientsServed?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-white p-3 rounded-xl border border-amber-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Total Priority Large Scale Patients</div>
                  <div className="text-xl font-black text-deep-navy tracking-tight">{stats.totalPriorityLargeScalePatients?.toLocaleString() || 0}</div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-[#374151] mb-3 uppercase tracking-wider">Programs Conducted in Large Scale Activities</h4>
                {stats.largeScaleProgramCounts && Object.keys(stats.largeScaleProgramCounts).length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Object.entries(stats.largeScaleProgramCounts).map(([program, count]) => (
                      <div key={program} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="text-sm text-gray-600 font-medium">{program}</span>
                        <span className="text-sm font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">{(count as number)?.toLocaleString() || 0}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg border border-gray-100">
                    No programs recorded in large scale activities yet.
                  </div>
                )}
              </div>
            </GroupCard>
          </div>
          )}

          {/* SLIDE 3: Geographical & Comparative Data */}
          {activeTab === 'geographic' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" id="slide-3">
            <GroupCard title="Provincial Accomplishment Map" icon={Home} id="provincial-map">
              <IlocosSurMap data={stats.municipalityStats} />
            </GroupCard>
            
            <GroupCard 
              title="Municipality Ranking" 
              icon={TrendingUp} 
              id="municipality-ranking"
            >
                  <div className="flex justify-end mb-4 shrink-0 data-[downloading=true]:hidden" data-downloading-hide="true">
                    <button 
                      onClick={downloadBarangayStats}
                      className="flex items-center gap-2 px-4 py-2 bg-deep-navy text-white rounded-lg hover:bg-soft-navy-blue transition-colors text-sm font-semibold"
                    >
                      <Download size={16} />
                      Download Stats (CSV)
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        stats.municipalityStats?.slice(0, Math.ceil((stats.municipalityStats?.length || 0) / 2)) || [],
                        stats.municipalityStats?.slice(Math.ceil((stats.municipalityStats?.length || 0) / 2)) || []
                      ].map((tableData, tableIdx) => (
                        <div key={tableIdx} className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="sticky top-0 bg-white z-10">
                              <tr className="text-left text-[10px] font-bold text-[#6B7280] uppercase tracking-wider border-b border-[#F3F4F6]">
                                <th className="pb-2 px-1 w-6 text-center">#</th>
                                <th className="pb-2 px-1">Municipality</th>
                                <th className="pb-2 px-1 text-right">Clients (S/T)</th>
                                <th className="pb-2 px-1 text-right">Cl. Cov.</th>
                                <th className="pb-2 px-1 text-right">HH (S/T)</th>
                                <th className="pb-2 px-1 text-right">HH Cov.</th>
                                <th className="pb-2 px-1 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F3F4F6]">
                              {tableData.length > 0 ? (
                                tableData.map((m, idx) => {
                                  const isUserMunicipality = currentUser.role === 'MUNICIPALITY' && m.name?.toLowerCase() === currentUser.municipality?.toLowerCase();
                                  const rank = tableIdx === 0 ? idx + 1 : idx + 1 + Math.ceil((stats.municipalityStats?.length || 0) / 2);
                                  return (
                                    <tr 
                                      key={idx} 
                                      className={`transition-all duration-200 ${
                                        isUserMunicipality 
                                          ? 'bg-gradient-to-r from-[#064E3B]/5 to-transparent hover:from-[#064E3B]/10 border-l-4 border-[#064E3B]' 
                                          : 'hover:bg-gray-50/80'
                                      }`}
                                    >
                                      <td className="py-1 px-1 font-bold text-gray-400 text-xs text-center w-6">
                                        {rank}
                                      </td>
                                      <td className="py-1 px-1 font-bold text-[#111827] text-xs">
                                        {formatMunicipality(m.name)}
                                        {isUserMunicipality && (
                                          <span className="ml-1 text-[8px] font-black text-[#064E3B] bg-[#064E3B]/10 px-1 py-0.5 rounded-full uppercase shadow-sm">Your Office</span>
                                        )}
                                      </td>
                                        <td className="py-1 px-1 text-right text-xs whitespace-nowrap">
                                          <span className="font-black text-[#064E3B]">{m?.served?.toLocaleString() || 0}</span>
                                          <span className="text-gray-300 mx-0.5 font-light">/</span>
                                          <span className="text-gray-500 font-medium">{m?.target?.toLocaleString() || 0}</span>
                                        </td>
                                        <td className="py-1 px-1 text-right">
                                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm ${getAccomplishmentColor(m.percentage, m.target > 0)}`}>
                                            {Math.round(m.percentage)}%
                                          </span>
                                        </td>
                                        <td className="py-1 px-1 text-right text-xs whitespace-nowrap">
                                          <span className="font-black text-[#064E3B]">{m?.householdsServed?.toLocaleString() || 0}</span>
                                          <span className="text-gray-300 mx-0.5 font-light">/</span>
                                          <span className="text-gray-500 font-medium">{m?.householdsTarget?.toLocaleString() || 0}</span>
                                        </td>
                                        <td className="py-1 px-1 text-right">
                                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm ${getAccomplishmentColor(m.householdsPercentage, m.householdsTarget > 0)}`}>
                                            {Math.round(m.householdsPercentage)}%
                                          </span>
                                        </td>
                                        <td className="py-1 px-1 text-right">
                                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm ${getAccomplishmentColor(m.totalPercentage, (m.target + m.householdsTarget) > 0)}`}>
                                            {Math.round(m.totalPercentage)}%
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })
                                ) : (
                                  tableIdx === 0 && (
                                    <tr>
                                      <td colSpan={6} className="py-4 text-center text-[#9CA3AF] text-xs italic">
                                        No data available
                                      </td>
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                  </div>
                </GroupCard>
          </div>
          )}

        </div>
      )}
    </div>
  );
}


