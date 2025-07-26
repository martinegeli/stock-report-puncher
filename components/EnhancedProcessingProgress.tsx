import React from 'react';
import { PipelineProgress } from '../types';
import { FileIcon, CheckIcon, AlertTriangleIcon, DownloadIcon, CpuChipIcon, SparklesIcon, DocumentTextIcon } from './Icons';
import Loader from './Loader';

interface EnhancedProcessingProgressProps {
  progress: PipelineProgress;
  onCancel?: () => void;
}

function EnhancedProcessingProgress({ progress, onCancel }: EnhancedProcessingProgressProps) {
  const getStageIcon = (stage: string, status: 'pending' | 'processing' | 'completed' | 'error') => {
    const iconClass = "h-5 w-5";
    
    if (status === 'error') {
      return <AlertTriangleIcon className={`${iconClass} text-red-400`} />;
    }
    if (status === 'completed') {
      return <CheckIcon className={`${iconClass} text-green-400`} />;
    }
    if (status === 'processing') {
      return <Loader className={iconClass} />;
    }
    
    // Pending - show stage-specific icon
    const pendingClass = `${iconClass} text-gray-500`;
    switch (stage) {
      case 'download': return <DownloadIcon className={pendingClass} />;
      case 'llamaparse': return <CpuChipIcon className={pendingClass} />;
      case 'gemini': return <SparklesIcon className={pendingClass} />;
      case 'sheets': return <DocumentTextIcon className={pendingClass} />;
      default: return <FileIcon className={pendingClass} />;
    }
  };

  const getStageName = (stage: string) => {
    switch (stage) {
      case 'download': return 'Download';
      case 'llamaparse': return 'Parse';
      case 'gemini': return 'Analyze';
      case 'sheets': return 'Save';
      default: return stage;
    }
  };

  const getCurrentStageTitle = () => {
    if (progress.isComplete) return 'Processing Complete!';
    
    switch (progress.currentStage) {
      case 'download': return 'Downloading from Google Drive';
      case 'llamaparse': return 'Parsing PDFs with LlamaParse';
      case 'gemini': return 'Analyzing with Gemini AI';
      case 'sheets': return 'Saving to Google Sheets';
      default: return 'Processing...';
    }
  };

  const getCurrentStageDescription = () => {
    if (progress.isComplete) return 'All files have been processed successfully!';
    
    switch (progress.currentStage) {
      case 'download': return 'Downloading PDF files from Google Drive...';
      case 'llamaparse': return 'Converting PDFs to structured JSON data...';
      case 'gemini': return 'Extracting financial data and organizing it...';
      case 'sheets': return 'Writing the processed data to your Google Sheet...';
      default: return 'Processing your files...';
    }
  };

  return (
    <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-lg border border-gray-700 w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">{getCurrentStageTitle()}</h2>
        <p className="text-gray-300">{getCurrentStageDescription()}</p>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-300 mb-2">
          <span>Overall Progress</span>
          <span>{progress.overallProgress}% Complete</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div 
            className="bg-indigo-600 h-3 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress.overallProgress}%` }}
          />
        </div>
      </div>

      {/* Current File Info */}
      {progress.currentFileName && !progress.isComplete && (
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <div className="flex items-center gap-3">
            <Loader />
            <div>
              <p className="text-gray-200 font-medium">
                Processing file {progress.currentFileIndex + 1} of {progress.totalFiles}:
              </p>
              <p className="text-gray-300 text-sm">{progress.currentFileName}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Stages Overview */}
      {progress.fileResults.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Processing Pipeline</h3>
          
          {/* Pipeline Header */}
          <div className="grid grid-cols-5 gap-2 mb-3 text-xs text-gray-400 uppercase tracking-wide">
            <div>File</div>
            <div className="text-center">Download</div>
            <div className="text-center">Parse</div>
            <div className="text-center">Analyze</div>
            <div className="text-center">Save</div>
          </div>

          {/* File Pipeline Status */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {progress.fileResults.map((result, index) => (
              <div
                key={result.id}
                className={`grid grid-cols-5 gap-2 p-3 rounded-lg border ${
                  result.error ? 'bg-red-900/20 border-red-700' : 'bg-gray-700 border-gray-600'
                }`}
              >
                {/* File Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400">#{index + 1}</span>
                  <span className="text-gray-200 text-sm truncate" title={result.fileName}>
                    {result.fileName}
                  </span>
                </div>

                {/* Download Stage */}
                <div className="flex items-center justify-center">
                  {getStageIcon('download', result.downloadStatus)}
                </div>

                {/* LlamaParse Stage */}
                <div className="flex items-center justify-center">
                  {getStageIcon('llamaparse', result.llamaParseStatus)}
                </div>

                {/* Gemini Stage */}
                <div className="flex items-center justify-center">
                  {getStageIcon('gemini', result.geminiStatus)}
                </div>

                {/* Sheets Stage */}
                <div className="flex items-center justify-center">
                  {getStageIcon('sheets', result.sheetsStatus)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing Summary */}
      {progress.fileResults.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-center">
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="text-2xl font-bold text-indigo-400">{progress.totalFiles}</div>
            <div className="text-xs text-gray-300 uppercase tracking-wide">Total Files</div>
          </div>
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="text-2xl font-bold text-green-400">
              {progress.fileResults.filter(f => 
                f.downloadStatus === 'completed' && 
                f.llamaParseStatus === 'completed' && 
                f.geminiStatus === 'completed' && 
                f.sheetsStatus === 'completed'
              ).length}
            </div>
            <div className="text-xs text-gray-300 uppercase tracking-wide">Completed</div>
          </div>
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">
              {progress.fileResults.filter(f => 
                f.downloadStatus === 'processing' || 
                f.llamaParseStatus === 'processing' || 
                f.geminiStatus === 'processing' || 
                f.sheetsStatus === 'processing'
              ).length}
            </div>
            <div className="text-xs text-gray-300 uppercase tracking-wide">Processing</div>
          </div>
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="text-2xl font-bold text-red-400">
              {progress.fileResults.filter(f => 
                f.downloadStatus === 'error' || 
                f.llamaParseStatus === 'error' || 
                f.geminiStatus === 'error' || 
                f.sheetsStatus === 'error'
              ).length}
            </div>
            <div className="text-xs text-gray-300 uppercase tracking-wide">Failed</div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center">
        {!progress.isComplete && onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-gray-600 text-gray-200 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel Processing
          </button>
        )}
        {progress.isComplete && (
          <div className="text-center">
            <div className="text-green-400 font-semibold mb-2">
              ✅ Processing completed successfully!
            </div>
            <div className="text-sm text-gray-300">
              All files have been processed and saved to your Google Sheet.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EnhancedProcessingProgress;