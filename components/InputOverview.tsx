import React from 'react';
import { InputFolderWithPreview } from '../types';
import { ArrowLeftIcon, FolderIcon, DocumentIcon } from './Icons';

interface InputOverviewProps {
  inputFolders: InputFolderWithPreview[];
  isLoading: boolean;
  onSelectStock: (stockName: string) => void;
  onBack: () => void;
  error: string | null;
}

function InputOverview({ inputFolders, isLoading, onSelectStock, onBack, error }: InputOverviewProps) {
  if (isLoading) {
    return (
      <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-lg border border-gray-700 w-full max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
            <ArrowLeftIcon className="h-6 w-6 text-gray-300"/>
          </button>
          <h2 className="text-2xl font-bold text-gray-100">Loading INPUT Folders</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-300">Loading available stock folders from INPUT...</p>
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
          <p className="text-sm text-gray-300">Choose a stock that has PDFs in INPUT folders ready to process</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {inputFolders.length === 0 ? (
        <div className="text-center py-8">
          <FolderIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-300 mb-2">No INPUT folders with PDFs found</p>
          <p className="text-sm text-gray-400">Upload PDF files to INPUT/{'{STOCK}'} folders in Google Drive to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {inputFolders.map((folder) => (
            <div
              key={folder.stockName}
              onClick={() => onSelectStock(folder.stockName)}
              className="bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg p-4 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <FolderIcon className="h-6 w-6 text-green-400" />
                <h3 className="text-lg font-semibold text-gray-100">{folder.stockName}</h3>
              </div>
              <div className="text-sm text-gray-300">
                <p className="mb-2">{folder.inputFiles.length} PDF{folder.inputFiles.length !== 1 ? 's' : ''} ready to process</p>
                
                {/* Show existing OUTPUT files if any */}
                {folder.outputFiles.length > 0 && (
                  <div className="mb-2 p-2 bg-blue-900/20 border border-blue-700 rounded">
                    <div className="flex items-center gap-1 mb-1">
                      <DocumentIcon className="h-3 w-3 text-blue-400" />
                      <span className="text-xs text-blue-400 font-medium">Existing Output:</span>
                    </div>
                    <div className="text-xs text-blue-300">
                      {folder.outputFiles.slice(0, 2).map((file) => (
                        <div key={file.id} className="truncate">• {file.name}</div>
                      ))}
                      {folder.outputFiles.length > 2 && (
                        <div>... and {folder.outputFiles.length - 2} more</div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="max-h-16 overflow-y-auto">
                  <div className="text-xs text-gray-400 mb-1">Input PDFs:</div>
                  {folder.inputFiles.slice(0, 2).map((file) => (
                    <div key={file.id} className="text-xs text-gray-400 truncate">
                      • {file.name}
                    </div>
                  ))}
                  {folder.inputFiles.length > 2 && (
                    <div className="text-xs text-gray-400">
                      ... and {folder.inputFiles.length - 2} more
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

export default InputOverview;