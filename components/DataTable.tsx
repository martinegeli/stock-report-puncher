import React, { useState } from 'react';
import { FinancialDataItem } from '../types';
import { SaveIcon, CheckIcon, ResetIcon, UploadIcon, SheetIcon, EyeIcon } from './Icons';
import Loader from './Loader';

interface DataTableProps {
  data: any[];
  stockName: string;
  isSaving: boolean;
  isSaveSuccess: boolean;
  sheetUrl?: string;
  rawGeminiOutput?: string;
  processingStats?: {
    filesProcessed: number;
    lineItemsFound: number;
    periodsFound: number;
    processingTime: number;
  };
  onAppend: () => void;
  onReset: () => void;
  onUploadNew: () => void;
}

const DataTable = ({ data, stockName, isSaving, isSaveSuccess, sheetUrl, rawGeminiOutput, processingStats, onAppend, onReset, onUploadNew }: DataTableProps) => {
  const [showRawOutput, setShowRawOutput] = useState(false);
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
        <div className="flex items-center justify-center gap-2 px-4 py-2 text-gray-400">
            <Loader />
            <span>Appending to Sheet...</span>
        </div>
      );
    }
    if (isSaveSuccess) {
      return (
        <div className="flex items-center justify-center gap-2 bg-green-900/20 text-green-400 font-semibold px-4 py-2 rounded-md border border-green-700">
           <CheckIcon className="h-5 w-5" />
           <span>Appended!{' '}
            {sheetUrl && (
              <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-green-300">
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
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        <SaveIcon className="h-5 w-5" />
        Append to Sheet
      </button>
    );
  };
  
  return (
    <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-lg border border-gray-700 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-100">Extracted Data for <span className="text-indigo-400">{stockName}</span></h2>
            {processingStats && (
              <div className="mt-2 text-sm text-gray-300">
                <span>Processed {processingStats.filesProcessed} file(s) • {processingStats.lineItemsFound} line items • {processingStats.periodsFound} periods • {processingStats.processingTime}ms</span>
              </div>
            )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {rawGeminiOutput && (
            <button
              onClick={() => setShowRawOutput(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 font-semibold rounded-md hover:bg-gray-600 transition-colors"
            >
              <EyeIcon className="h-5 w-5" />
              View Raw Output
            </button>
          )}
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
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 font-semibold rounded-md hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
          >
            <ResetIcon className="h-5 w-5" />
            Main Menu
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[60vh] rounded-lg border border-gray-600">
        <table className="w-full text-sm text-left text-gray-200">
          <thead className="text-xs text-gray-100 uppercase bg-gray-700 sticky top-0">
            <tr>
              <th scope="col" className="px-6 py-3 font-bold">Line Item</th>
              {periods.map(period => (
                <th key={period} scope="col" className="px-6 py-3 font-bold text-right">{period}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="bg-gray-800 border-b border-gray-700 last:border-b-0 hover:bg-gray-750">
                <td className="px-6 py-4 font-medium text-gray-100">{item.lineItem}</td>
                {periods.map(period => (
                  <td key={period} className="px-6 py-4 text-right font-mono whitespace-nowrap text-gray-200">{item[period] || ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Raw Output Dialog */}
      {showRawOutput && rawGeminiOutput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-xl font-bold text-gray-100">Raw Gemini Output</h3>
              <button
                onClick={() => setShowRawOutput(false)}
                className="text-gray-400 hover:text-gray-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[60vh]">
              <pre className="text-sm text-gray-300 bg-gray-800 p-4 rounded border border-gray-700 overflow-x-auto">
                {JSON.stringify(JSON.parse(rawGeminiOutput), null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
