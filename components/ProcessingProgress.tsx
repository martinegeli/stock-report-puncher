import React from 'react';
import { BatchProcessingProgress } from '../services/llamaParseService';
import { FileIcon, CheckIcon, AlertTriangleIcon } from './Icons';
import Loader from './Loader';

interface ProcessingProgressProps {
  progress: BatchProcessingProgress;
  currentStage: 'llamaparse' | 'gemini' | 'saving';
  onCancel?: () => void;
}

function ProcessingProgress({ progress, currentStage, onCancel }: ProcessingProgressProps) {
  const getStageTitle = () => {
    switch (currentStage) {
      case 'llamaparse':
        return 'Processing PDFs with LlamaParse';
      case 'gemini':
        return 'Analyzing Data with Gemini';
      case 'saving':
        return 'Saving to Google Sheets';
      default:
        return 'Processing...';
    }
  };

  const getStageDescription = () => {
    switch (currentStage) {
      case 'llamaparse':
        return 'Converting PDFs to structured JSON data...';
      case 'gemini':
        return 'Extracting financial data and organizing it for your sheet...';
      case 'saving':
        return 'Updating your Google Sheets with the new data...';
      default:
        return 'Please wait while we process your files...';
    }
  };

  const completedCount = progress.results.filter(r => r.status === 'completed').length;
  const errorCount = progress.results.filter(r => r.status === 'error').length;
  const progressPercentage = progress.totalFiles > 0 ? (completedCount / progress.totalFiles) * 100 : 0;

  return (
    <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-lg border border-gray-700 w-full max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">{getStageTitle()}</h2>
        <p className="text-gray-300">{getStageDescription()}</p>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-300 mb-2">
          <span>Overall Progress</span>
          <span>{completedCount} of {progress.totalFiles} files</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div 
            className="bg-indigo-600 h-3 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Current File */}
      {progress.currentFile && (
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <div className="flex items-center gap-3">
            <Loader />
            <div>
              <p className="text-gray-200 font-medium">Currently processing:</p>
              <p className="text-gray-300 text-sm">{progress.currentFile}</p>
            </div>
          </div>
        </div>
      )}

      {/* File Results */}
      {progress.results.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-3">File Status</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {progress.results.map((result) => (
              <div
                key={result.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  result.status === 'completed'
                    ? 'bg-green-900/20 border-green-700'
                    : result.status === 'error'
                    ? 'bg-red-900/20 border-red-700'
                    : 'bg-gray-700 border-gray-600'
                }`}
              >
                {result.status === 'completed' ? (
                  <CheckIcon className="h-5 w-5 text-green-400" />
                ) : result.status === 'error' ? (
                  <AlertTriangleIcon className="h-5 w-5 text-red-400" />
                ) : (
                  <FileIcon className="h-5 w-5 text-gray-400" />
                )}
                
                <div className="flex-1">
                  <p className="text-gray-200 text-sm font-medium">{result.fileName}</p>
                  {result.status === 'error' && result.error && (
                    <p className="text-red-300 text-xs mt-1">{result.error}</p>
                  )}
                  {result.status === 'completed' && result.processedAt && (
                    <p className="text-green-300 text-xs mt-1">
                      Completed at {result.processedAt.toLocaleTimeString()}
                    </p>
                  )}
                </div>

                <div className={`text-xs px-2 py-1 rounded ${
                  result.status === 'completed'
                    ? 'bg-green-800 text-green-200'
                    : result.status === 'error'
                    ? 'bg-red-800 text-red-200'
                    : result.status === 'processing'
                    ? 'bg-blue-800 text-blue-200'
                    : 'bg-gray-800 text-gray-200'
                }`}>
                  {result.status === 'completed' ? 'Done' :
                   result.status === 'error' ? 'Error' :
                   result.status === 'processing' ? 'Processing' : 'Pending'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {progress.processedFiles > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-700 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-indigo-400">{completedCount}</div>
            <div className="text-xs text-gray-300">Completed</div>
          </div>
          <div className="bg-gray-700 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-yellow-400">{progress.processedFiles - completedCount - errorCount}</div>
            <div className="text-xs text-gray-300">Processing</div>
          </div>
          <div className="bg-gray-700 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-red-400">{errorCount}</div>
            <div className="text-xs text-gray-300">Errors</div>
          </div>
        </div>
      )}

      {/* Cancel Button */}
      {onCancel && !progress.isComplete && (
        <div className="text-center">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 text-gray-200 rounded-lg hover:bg-gray-500 transition-colors"
          >
            Cancel Processing
          </button>
        </div>
      )}
    </div>
  );
}

export default ProcessingProgress;