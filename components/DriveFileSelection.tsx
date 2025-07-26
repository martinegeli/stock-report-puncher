import React, { useState, useEffect } from 'react';
import { DriveFile } from '../types';
import { ArrowLeftIcon, FileIcon, DocumentIcon, CheckIcon } from './Icons';
import { isFileProcessed, getProcessedFilesForStock } from '../services/processedFilesService';

interface DriveFileSelectionProps {
  stockName: string;
  inputFiles: DriveFile[];
  isLoadingFiles: boolean;
  selectedFiles: DriveFile[];
  onFileToggle: (file: DriveFile) => void;
  onProcess: () => void;
  onBack: () => void;
  error: string | null;
}

function DriveFileSelection({ 
  stockName, 
  inputFiles, 
  isLoadingFiles, 
  selectedFiles, 
  onFileToggle, 
  onProcess, 
  onBack, 
  error 
}: DriveFileSelectionProps) {
  const [selectAll, setSelectAll] = useState(false);
  const [processedFiles, setProcessedFiles] = useState<Set<string>>(new Set());

  // Load processed files when component mounts or stock changes
  useEffect(() => {
    const processed = getProcessedFilesForStock(stockName);
    const processedIds = new Set(processed.map(f => f.fileId));
    setProcessedFiles(processedIds);
  }, [stockName, inputFiles]);

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    
    if (newSelectAll) {
      inputFiles.forEach(file => {
        if (!selectedFiles.find(sf => sf.id === file.id)) {
          onFileToggle(file);
        }
      });
    } else {
      selectedFiles.forEach(file => {
        onFileToggle(file);
      });
    }
  };

  if (isLoadingFiles) {
    return (
      <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-lg border border-gray-700 w-full max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
            <ArrowLeftIcon className="h-6 w-6 text-gray-300"/>
          </button>
          <h2 className="text-2xl font-bold text-gray-100">Loading Files for <span className="text-indigo-400">{stockName}</span></h2>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-300">Loading PDF files from INPUT/{stockName}...</p>
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
          <h2 className="text-2xl font-bold text-gray-100">Select PDFs from <span className="text-indigo-400">INPUT/{stockName}</span></h2>
          <p className="text-sm text-gray-300">Choose which PDF files to process with the script</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {inputFiles.length === 0 ? (
        <div className="text-center py-8">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-300 mb-2">No PDF files found in INPUT/{stockName}</p>
          <p className="text-sm text-gray-400">Make sure PDF files are uploaded to the INPUT/{stockName} folder in Google Drive</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="selectAll"
                checked={selectAll}
                onChange={handleSelectAll}
                className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
              />
              <label htmlFor="selectAll" className="text-sm text-gray-300">
                Select all ({inputFiles.length} files)
              </label>
            </div>
            <div className="text-sm text-gray-400">
              {selectedFiles.length} selected
            </div>
          </div>

          <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
            {inputFiles.map((file) => {
              const isSelected = selectedFiles.find(sf => sf.id === file.id) !== undefined;
              const isProcessed = processedFiles.has(file.id);
              return (
                <div
                  key={file.id}
                  onClick={() => onFileToggle(file)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-indigo-900/50 border-indigo-500' 
                      : isProcessed
                      ? 'bg-green-900/20 border-green-700 hover:bg-green-900/30'
                      : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // Handled by onClick on parent div
                    className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                  />
                  <FileIcon className="h-5 w-5 text-red-400" />
                  <span className="text-gray-200 flex-1 truncate">{file.name}</span>
                  {isProcessed && (
                    <div className="flex items-center gap-1 text-green-400 text-xs">
                      <CheckIcon className="h-4 w-4" />
                      <span>Processed</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-4">
            <button
              onClick={onProcess}
              disabled={selectedFiles.length === 0}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                selectedFiles.length === 0
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              Process {selectedFiles.length} Selected File{selectedFiles.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriveFileSelection;