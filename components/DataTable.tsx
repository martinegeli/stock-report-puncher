import React from 'react';
import { FinancialDataItem } from '../types';
import { SaveIcon, CheckIcon, ResetIcon, UploadIcon, SheetIcon } from './Icons';
import Loader from './Loader';

interface DataTableProps {
  data: any[];
  stockName: string;
  isSaving: boolean;
  isSaveSuccess: boolean;
  sheetUrl?: string;
  onAppend: () => void;
  onReset: () => void;
  onUploadNew: () => void;
}

const DataTable = ({ data, stockName, isSaving, isSaveSuccess, sheetUrl, onAppend, onReset, onUploadNew }: DataTableProps) => {
  // Collect all unique period keys (columns) from the data
  const periodSet = new Set<string>();
  data.forEach(item => {
    Object.keys(item).forEach(key => {
      if (key !== 'lineItem') periodSet.add(key);
    });
  });
  const periods = Array.from(periodSet).sort();

  const renderSaveButton = () => {
    if (isSaving) {
      return (
        <div className="flex items-center justify-center gap-2 px-4 py-2 text-slate-600">
            <Loader />
            <span>Appending to Sheet...</span>
        </div>
      );
    }
    if (isSaveSuccess) {
      return (
        <div className="flex items-center justify-center gap-2 bg-green-100 text-green-800 font-semibold px-4 py-2 rounded-md">
           <CheckIcon className="h-5 w-5" />
           <span>Appended!{' '}
            {sheetUrl && (
              <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-green-900">
                  View Master Sheet
              </a>
            )}
           </span>
        </div>
      );
    }
    return (
      <button
        onClick={onAppend}
        disabled={!sheetUrl}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
      >
        <SaveIcon className="h-5 w-5" />
        Append to Sheet
      </button>
    );
  };
  
  return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-lg border border-slate-200 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Extracted Data for <span className="text-indigo-600">{stockName}</span></h2>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {renderSaveButton()}
          {isSaveSuccess && (
            <button
                onClick={onUploadNew}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors"
            >
                <UploadIcon className="h-5 w-5"/>
                Upload Another
            </button>
          )}
           <button
            onClick={onReset}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-md hover:bg-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
          >
            <ResetIcon className="h-5 w-5" />
            Main Menu
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[60vh] rounded-lg border border-slate-200">
        <table className="w-full text-sm text-left text-slate-700">
          <thead className="text-xs text-slate-800 uppercase bg-slate-100 sticky top-0">
            <tr>
              <th scope="col" className="px-6 py-3 font-bold">Line Item</th>
              {periods.map(period => (
                <th key={period} scope="col" className="px-6 py-3 font-bold text-right">{period}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="bg-white border-b last:border-b-0 hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">{item.lineItem}</td>
                {periods.map(period => (
                  <td key={period} className="px-6 py-4 text-right font-mono whitespace-nowrap">{item[period] || ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
