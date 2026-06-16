import React from 'react';
import { MunicipalityStat } from '../types';

interface IlocosSurMapProps {
  data: MunicipalityStat[];
}

const GRID_LAYOUT = [
  { name: "Sinait", colStart: 3, colEnd: 7, rowStart: 1, rowEnd: 3 },
  { name: "Cabugao", colStart: 4, colEnd: 9, rowStart: 3, rowEnd: 5 },
  { name: "San Juan", colStart: 3, colEnd: 8, rowStart: 5, rowEnd: 7 },
  { name: "Magsingal", colStart: 3, colEnd: 7, rowStart: 7, rowEnd: 9 },
  { name: "Santo Domingo", colStart: 2, colEnd: 5, rowStart: 9, rowEnd: 11 },
  { name: "San Ildefonso", colStart: 5, colEnd: 8, rowStart: 9, rowEnd: 11 },
  { name: "San Vicente", colStart: 1, colEnd: 3, rowStart: 11, rowEnd: 12 },
  { name: "Bantay", colStart: 3, colEnd: 7, rowStart: 11, rowEnd: 13 },
  { name: "Santa Catalina", colStart: 1, colEnd: 3, rowStart: 12, rowEnd: 13 },
  { name: "City of Vigan", colStart: 2, colEnd: 5, rowStart: 13, rowEnd: 15 },
  { name: "Caoayan", colStart: 2, colEnd: 5, rowStart: 15, rowEnd: 16 },
  { name: "Santa", colStart: 5, colEnd: 9, rowStart: 13, rowEnd: 16 },
  { name: "Narvacan", colStart: 3, colEnd: 8, rowStart: 16, rowEnd: 18 },
  { name: "Nagbukel", colStart: 8, colEnd: 11, rowStart: 16, rowEnd: 18 },
  { name: "Santa Maria", colStart: 3, colEnd: 6, rowStart: 18, rowEnd: 20 },
  { name: "Burgos", colStart: 6, colEnd: 9, rowStart: 18, rowEnd: 20 },
  { name: "San Esteban", colStart: 2, colEnd: 4, rowStart: 20, rowEnd: 21 },
  { name: "Banayoyo", colStart: 4, colEnd: 6, rowStart: 20, rowEnd: 22 },
  { name: "Lidlidda", colStart: 6, colEnd: 8, rowStart: 20, rowEnd: 23 },
  { name: "San Emilio", colStart: 8, colEnd: 11, rowStart: 20, rowEnd: 23 },
  { name: "Santiago", colStart: 2, colEnd: 4, rowStart: 21, rowEnd: 23 },
  { name: "Galimuyod", colStart: 4, colEnd: 6, rowStart: 22, rowEnd: 25 },
  { name: "City of Candon", colStart: 2, colEnd: 4, rowStart: 23, rowEnd: 25 },
  { name: "Salcedo", colStart: 6, colEnd: 9, rowStart: 23, rowEnd: 25 },
  { name: "Gregorio del Pilar", colStart: 9, colEnd: 11, rowStart: 23, rowEnd: 25 },
  { name: "Quirino", colStart: 11, colEnd: 13, rowStart: 21, rowEnd: 25 },
  { name: "Santa Lucia", colStart: 2, colEnd: 4, rowStart: 25, rowEnd: 26 },
  { name: "Sigay", colStart: 4, colEnd: 7, rowStart: 25, rowEnd: 28 },
  { name: "Cervantes", colStart: 7, colEnd: 12, rowStart: 25, rowEnd: 28 },
  { name: "Santa Cruz", colStart: 2, colEnd: 4, rowStart: 26, rowEnd: 28 },
  { name: "Tagudin", colStart: 2, colEnd: 5, rowStart: 28, rowEnd: 30 },
  { name: "Suyo", colStart: 5, colEnd: 9, rowStart: 28, rowEnd: 30 },
  { name: "Alilem", colStart: 6, colEnd: 10, rowStart: 30, rowEnd: 32 },
  { name: "Sugpon", colStart: 7, colEnd: 11, rowStart: 32, rowEnd: 34 },
];

export default function IlocosSurMap({ data }: IlocosSurMapProps) {
  const getColor = (percentage: number, hasTarget: boolean) => {
    if (!hasTarget) return 'bg-slate-100 text-slate-400 border-slate-200'; // No data
    if (percentage >= 100) return 'bg-[#064E3B] text-white border-[#022C22]'; // DOH Green
    if (percentage >= 75) return 'bg-[#4ADE80] text-[#064E3B] border-[#22C55E]'; // Light Green
    if (percentage >= 50) return 'bg-[#FBBF24] text-[#78350F] border-[#F59E0B]'; // Yellow
    if (percentage >= 25) return 'bg-[#FB923C] text-[#7C2D12] border-[#F97316]'; // Orange
    return 'bg-[#F87171] text-[#7F1D1D] border-[#EF4444]'; // Red (< 25%, including 0%)
  };

  const getStat = (name: string) => {
    if (!data) return undefined;
    return data.find(d => d.name?.toLowerCase() === name.toLowerCase());
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
      <h3 className="text-lg font-bold text-[#005A9C] mb-6 self-start">Provincial Accomplishment Map</h3>
      
      <div className="w-full max-w-[500px] mx-auto">
        <div 
          className="grid gap-0.5 md:gap-1"
          style={{ 
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(33, minmax(32px, 1fr))'
          }}
        >
          {GRID_LAYOUT.map((cell) => {
            const stat = getStat(cell.name);
            const percentage = stat ? (stat.totalPercentage || 0) : 0;
            const hasTarget = stat ? ((stat.target || 0) + (stat.householdsTarget || 0)) > 0 : false;
            const colorClass = getColor(percentage, hasTarget);
            
            return (
              <div
                key={cell.name}
                className={`relative group flex items-center justify-center rounded-sm border transition-all duration-300 hover:scale-105 hover:z-10 cursor-pointer shadow-sm ${colorClass}`}
                style={{
                  gridColumnStart: cell.colStart,
                  gridColumnEnd: cell.colEnd,
                  gridRowStart: cell.rowStart,
                  gridRowEnd: cell.rowEnd,
                }}
              >
                <span className="text-[0.4rem] md:text-[0.55rem] font-bold text-center leading-tight px-0.5 truncate w-full">
                  {cell.name}
                </span>
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-xs rounded-lg py-2 px-3 opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-xl transition-opacity">
                  <div className="font-bold text-sm mb-1 border-b border-slate-600 pb-1">{cell.name}</div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Target (Clients):</span>
                    <span className="font-semibold">{stat?.target || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Served (Clients):</span>
                    <span className="font-semibold">{stat?.served || 0}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-300">Target (HH):</span>
                    <span className="font-semibold">{stat?.householdsTarget || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Served (HH):</span>
                    <span className="font-semibold">{stat?.householdsServed || 0}</span>
                  </div>
                  <div className="flex justify-between mt-1 pt-1 border-t border-slate-600">
                    <span className="text-slate-300">Total Coverage:</span>
                    <span className="font-bold text-[#4ADE80]">{hasTarget ? `${percentage.toFixed(1)}%` : 'N/A'}</span>
                  </div>
                  {/* Triangle pointer */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs font-medium text-slate-600">
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-[#064E3B] border border-[#022C22]"></div> 100%+</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-[#4ADE80] border border-[#22C55E]"></div> 75-99%</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-[#FBBF24] border border-[#F59E0B]"></div> 50-74%</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-[#FB923C] border border-[#F97316]"></div> 25-49%</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-[#F87171] border border-[#EF4444]"></div> &lt;25%</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-slate-100 border border-slate-200"></div> No Data</div>
      </div>
    </div>
  );
}
