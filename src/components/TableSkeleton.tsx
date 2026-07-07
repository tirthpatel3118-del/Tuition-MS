import React from 'react';

interface TableSkeletonProps {
  columnCount: number;
  rowCount?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ columnCount, rowCount = 5 }) => {
  const rows = Array.from({ length: rowCount });
  const cols = Array.from({ length: columnCount });

  return (
    <div className="w-full bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden animate-pulse">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <div className="h-4 bg-slate-200 rounded-md w-1/4"></div>
        <div className="h-8 bg-slate-200 rounded-xl w-32"></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/30 border-b border-slate-100">
              {cols.map((_, idx) => (
                <th key={idx} className="px-5 py-3.5">
                  <div className={`h-3 bg-slate-200 rounded-md ${idx === 0 ? 'w-24' : idx === columnCount - 1 ? 'w-16 ml-auto' : 'w-20'}`}></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((_, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/10">
                {cols.map((_, cIdx) => (
                  <td key={cIdx} className="px-5 py-4">
                    {cIdx === 0 ? (
                      <div className="space-y-1.5">
                        <div className="h-4 bg-slate-200 rounded-md w-32"></div>
                        <div className="h-3 bg-slate-150 rounded-md w-24"></div>
                      </div>
                    ) : cIdx === columnCount - 1 ? (
                      <div className="h-7 bg-slate-200 rounded-lg w-20 ml-auto"></div>
                    ) : (
                      <div className={`h-4 bg-slate-150 rounded-md ${cIdx % 2 === 0 ? 'w-16' : 'w-20'}`}></div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
