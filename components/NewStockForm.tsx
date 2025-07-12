import React, { useState } from 'react';
import { ArrowLeftIcon, FolderPlusIcon } from './Icons';
import Loader from './Loader';

interface NewStockFormProps {
  onSubmit: (ticker: string) => void;
  onBack: () => void;
  isLoading: boolean;
  error: string | null;
}

const NewStockForm: React.FC<NewStockFormProps> = ({ onSubmit, onBack, isLoading, error }) => {
  const [ticker, setTicker] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticker.trim()) {
      onSubmit(ticker.trim().toUpperCase());
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-lg border border-slate-200 w-full max-w-md mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
          <ArrowLeftIcon className="h-6 w-6 text-slate-700" />
        </button>
        <h2 className="text-2xl font-bold text-slate-800">Add a New Stock</h2>
      </div>
      <p className="mb-4 text-slate-600">
        Enter a stock ticker symbol (e.g., AAPL, GOOG) to create a new folder for it in your Google Drive.
      </p>
      
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}

      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="w-full flex-grow px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Enter Ticker Symbol"
            aria-label="Stock Ticker Symbol"
            required
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!ticker || isLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader />
            ) : (
              <FolderPlusIcon className="h-5 w-5" />
            )}
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewStockForm;
