import React from 'react';
import { OutputFolder } from '../types';
import { ArrowLeftIcon, FolderIcon } from './Icons';

interface OutputOverviewProps {
  outputFolders: OutputFolder[];
  isLoading: boolean;
  onSelectStock: (stockName: string) => void;
  onBack: () => void;
  error: string | null;
}

function OutputOverview({ outputFolders, isLoading, onSelectStock, onBack, error }: OutputOverviewProps) {
  if (isLoading) {
    return (
      <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-lg border border-gray-700 w-full max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
            <ArrowLeftIcon className="h-6 w-6 text-gray-300"/>
          </button>
          <h2 className="text-2xl font-bold text-gray-100">Output Overview</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-300">Loading existing OUTPUT files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-lg border border-gray-700 w-full max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
          <ArrowLeftIcon className="h-6 w-6 text-gray-300"/>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Select Stock to Process</h2>
          <p className="text-sm text-gray-300">Choose a stock that has files in OUTPUT to run the script with</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {outputFolders.length === 0 ? (
        <div className="text-center py-8">
          <FolderIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-300 mb-2">No OUTPUT folders found</p>
          <p className="text-sm text-gray-400">Create some stock folders with data first before selecting files to process</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {outputFolders.map((folder) => (
            <div
              key={folder.stockName}
              onClick={() => onSelectStock(folder.stockName)}
              className="bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg p-4 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <FolderIcon className="h-6 w-6 text-indigo-400" />
                <h3 className="text-lg font-semibold text-gray-100">{folder.stockName}</h3>
              </div>
              <div className="text-sm text-gray-300">
                <p className="mb-2">{folder.files.length} file{folder.files.length !== 1 ? 's' : ''} available</p>
                <div className="max-h-20 overflow-y-auto">
                  {folder.files.slice(0, 3).map((file) => (
                    <div key={file.id} className="text-xs text-gray-400 truncate">
                      • {file.name}
                    </div>
                  ))}
                  {folder.files.length > 3 && (
                    <div className="text-xs text-gray-400">
                      ... and {folder.files.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OutputOverview;