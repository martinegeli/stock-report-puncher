import React, { useState } from 'react';
import { StockFolder } from '../types';
import { UploadIcon, FileIcon, ArrowLeftIcon } from './Icons';

interface UploadViewProps {
  stock: StockFolder;
  files: File[];
  onFileChange: (files: File[]) => void;
  onProcess: () => void;
  onBack: () => void;
}

function UploadView({ stock, files, onFileChange, onProcess, onBack }: UploadViewProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) {
      onFileChange([]);
      setError(null);
      return;
    }
    const validFiles = Array.from(selectedFiles).filter(f => f.type === 'application/pdf');
    if (validFiles.length !== selectedFiles.length) {
      setError('Please upload only PDF files.');
    } else {
      setError(null);
    }
    onFileChange(validFiles);
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = files.slice();
    newFiles.splice(index, 1);
    onFileChange(newFiles);
  };

  const handleDragEvents = (e: React.DragEvent<HTMLLabelElement>, over: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(over);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    handleDragEvents(e, false);
    const droppedFiles = e.dataTransfer.files;
    handleFileChange(droppedFiles);
  };

  return (
    <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-lg border border-gray-700 w-full max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                <ArrowLeftIcon className="h-6 w-6 text-gray-300"/>
            </button>
            <div>
                <h2 className="text-2xl font-bold text-gray-100">Upload Statements for <span className="text-indigo-400">{stock.name}</span></h2>
                <p className="text-sm text-gray-300">Select one or more PDF documents to extract financial data.</p>
            </div>
        </div>
        <div className="w-full">
            {files.length === 0 ? (
                <label
                    onDragEnter={(e) => handleDragEvents(e, true)}
                    onDragLeave={(e) => handleDragEvents(e, false)}
                    onDragOver={(e) => handleDragEvents(e, true)}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragOver ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-600 bg-gray-700 hover:bg-gray-600'}`}
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadIcon className="w-10 h-10 mb-4 text-gray-400" />
                        <p className="mb-2 text-sm text-gray-300"><span className="font-semibold text-indigo-400">Click to upload</span> or drag and drop</p>
                        <p className="text-xs text-gray-400">PDF only (max 10MB each, multiple allowed)</p>
                    </div>
                    <input id="dropzone-file" type="file" className="hidden" accept="application/pdf" multiple onChange={(e) => handleFileChange(e.target.files)} />
                </label>
            ) :
                <div className="bg-gray-700 rounded-lg border border-gray-600 p-4">
                    <div className="mb-4">
                        <p className="font-semibold text-gray-200 mb-2">Selected files:</p>
                        <ul className="space-y-2">
                            {files.map((f, idx) => (
                                <li key={idx} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2 border border-gray-600">
                                    <span className="truncate max-w-xs text-gray-200">{f.name} <span className="text-xs text-gray-400">({(f.size / 1024 / 1024).toFixed(2)} MB)</span></span>
                                    <button onClick={() => handleRemoveFile(idx)} className="ml-2 text-red-500 hover:text-red-700 font-bold">&times;</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-gray-200 font-semibold rounded-md hover:bg-gray-500 cursor-pointer">
                            <UploadIcon className="h-5 w-5" />
                            Add More PDFs
                            <input type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => handleFileChange(e.target.files)} />
                        </label>
                        <button
                            onClick={onProcess}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            disabled={files.length === 0}
                        >
                            Process Financial Statements
                        </button>
                    </div>
                </div>
            }
            {error && <p className="mt-4 text-sm text-red-400 text-center">{error}</p>}
        </div>
    </div>
  );
}
export default UploadView;
