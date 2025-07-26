import React, { useState } from 'react';
import { LlamaParseResult } from '../services/llamaParseService';
import { ArrowLeftIcon, CheckIcon, AlertTriangleIcon, EyeIcon } from './Icons';

interface LlamaParseReviewProps {
  results: LlamaParseResult[];
  stockName: string;
  hasExistingSheet: boolean;
  onProceedToGemini: (operationType: 'create' | 'update') => void;
  onBack: () => void;
}

function LlamaParseReview({ 
  results, 
  stockName, 
  hasExistingSheet,
  onProceedToGemini, 
  onBack 
}: LlamaParseReviewProps) {
  const [selectedResult, setSelectedResult] = useState<LlamaParseResult | null>(null);
  const [operationType, setOperationType] = useState<'create' | 'update'>(hasExistingSheet ? 'update' : 'create');

  const successfulResults = results.filter(r => r.status === 'completed' && r.jsonData);
  const failedResults = results.filter(r => r.status === 'error');

  const formatJsonForDisplay = (data: any): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return 'Unable to display JSON data';
    }
  };

  return (
    <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-lg border border-gray-700 w-full max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
          <ArrowLeftIcon className="h-6 w-6 text-gray-300"/>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Review LlamaParse Results for <span className="text-indigo-400">{stockName}</span></h2>
          <p className="text-sm text-gray-300">Review the parsed JSON data before sending to Gemini for analysis</p>
        </div>
      </div>

      {/* Results Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-700 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-400">{successfulResults.length}</div>
          <div className="text-sm text-gray-300">Successfully Parsed</div>
        </div>
        <div className="bg-gray-700 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-400">{failedResults.length}</div>
          <div className="text-sm text-gray-300">Failed to Parse</div>
        </div>
        <div className="bg-gray-700 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-indigo-400">{results.length}</div>
          <div className="text-sm text-gray-300">Total Files</div>
        </div>
      </div>

      {/* Operation Type Selection */}
      {hasExistingSheet && (
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-200 mb-3">Sheet Operation Mode</h3>
          <p className="text-sm text-gray-300 mb-3">
            Existing sheet detected for {stockName}. Choose how to handle the data:
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="operationType"
                value="update"
                checked={operationType === 'update'}
                onChange={(e) => setOperationType(e.target.value as 'create' | 'update')}
                className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-gray-200 font-medium">Use Existing Sheet</span>
                <p className="text-xs text-gray-400">Add new periods to existing line items</p>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="operationType"
                value="create"
                checked={operationType === 'create'}
                onChange={(e) => setOperationType(e.target.value as 'create' | 'update')}
                className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-gray-200 font-medium">Restart Fresh</span>
                <p className="text-xs text-gray-400">Create a completely new structure</p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* File Results List */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-3">Parsed Files</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {results.map((result) => (
            <div
              key={result.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                result.status === 'completed'
                  ? 'bg-green-900/20 border-green-700'
                  : 'bg-red-900/20 border-red-700'
              }`}
            >
              {result.status === 'completed' ? (
                <CheckIcon className="h-5 w-5 text-green-400" />
              ) : (
                <AlertTriangleIcon className="h-5 w-5 text-red-400" />
              )}
              
              <div className="flex-1">
                <p className="text-gray-200 text-sm font-medium">{result.fileName}</p>
                {result.error && (
                  <p className="text-red-300 text-xs mt-1">{result.error}</p>
                )}
              </div>

              {result.status === 'completed' && result.jsonData && (
                <button
                  onClick={() => setSelectedResult(result)}
                  className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition-colors"
                >
                  <EyeIcon className="h-4 w-4" />
                  View JSON
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* JSON Preview Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedResult(null)}>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 w-full max-w-4xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-200">
                JSON Data: {selectedResult.fileName}
              </h3>
              <button
                onClick={() => setSelectedResult(null)}
                className="text-gray-400 hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="bg-gray-900 p-4 rounded border max-h-96 overflow-auto">
              <pre className="text-gray-300 text-xs whitespace-pre-wrap">
                {formatJsonForDisplay(selectedResult.jsonData)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        {successfulResults.length > 0 ? (
          <button
            onClick={() => onProceedToGemini(operationType)}
            className="flex-1 py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Continue to Gemini Analysis ({successfulResults.length} file{successfulResults.length !== 1 ? 's' : ''})
          </button>
        ) : (
          <div className="flex-1 py-3 px-4 bg-gray-600 text-gray-400 font-semibold rounded-lg text-center">
            No files successfully parsed - cannot continue
          </div>
        )}
        
        <button
          onClick={onBack}
          className="px-6 py-3 bg-gray-600 text-gray-200 font-semibold rounded-lg hover:bg-gray-500 transition-colors"
        >
          Go Back
        </button>
      </div>

      {failedResults.length > 0 && (
        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
          <p className="text-yellow-300 text-sm">
            ⚠️ {failedResults.length} file{failedResults.length !== 1 ? 's' : ''} failed to parse. 
            Only successfully parsed files will be sent to Gemini.
          </p>
        </div>
      )}
    </div>
  );
}

export default LlamaParseReview;