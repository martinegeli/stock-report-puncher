import React from 'react';
import { StockFolder } from '../types';
import { FolderIcon, ArrowLeftIcon, SheetIcon, UploadIcon } from './Icons';
import Loader from './Loader';

interface StockFolderListProps {
  folders: StockFolder[];
  isLoading: boolean;
  error: string | null;
  onSelectStock: (stock: StockFolder) => void;
  onBack: () => void;
}

const StockFolderList: React.FC<StockFolderListProps> = ({ folders, isLoading, error, onSelectStock, onBack }) => {
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="text-center py-10">
          <Loader />
          <p className="mt-4 text-slate-600">Fetching stock folders from Google Drive...</p>
        </div>
      );
    }
    
    if (folders.length === 0) {
      return (
        <div className="text-center py-10 px-4">
            <FolderIcon className="h-12 w-12 mx-auto text-slate-400"/>
            <h3 className="mt-2 text-lg font-semibold text-slate-800">No Stock Folders Found</h3>
            <p className="mt-1 text-sm text-slate-500">Go back and create a new stock folder to get started.</p>
        </div>
      )
    }
    
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map((folder) => (
                <div key={folder.id} className="bg-white p-4 rounded-lg shadow-md border border-slate-200 flex flex-col justify-between transition-all hover:shadow-lg hover:border-indigo-200">
                    <div>
                        <FolderIcon className="h-10 w-10 text-indigo-500 mb-2"/>
                        <h3 className="font-bold text-slate-800 text-2xl truncate">{folder.name}</h3>
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                        <a 
                            href={folder.sheetUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className={`inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${
                              folder.sheetUrl 
                                ? 'text-green-700 bg-green-100 hover:bg-green-200' 
                                : 'text-slate-500 bg-slate-100 cursor-not-allowed'
                            }`}
                            aria-disabled={!folder.sheetUrl}
                            onClick={(e) => !folder.sheetUrl && e.preventDefault()}
                        >
                            <SheetIcon className="h-5 w-5" />
                            {folder.sheetUrl ? 'View Master Sheet' : 'No Sheet Found'}
                        </a>
                        <button 
                            onClick={() => onSelectStock(folder)} 
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-md hover:bg-indigo-200 transition-colors"
                        >
                            <UploadIcon className="h-5 w-5" />
                            Upload Report
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-lg border border-slate-200 w-full">
      <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <ArrowLeftIcon className="h-6 w-6 text-slate-700"/>
          </button>
          <h2 className="text-2xl font-bold text-slate-800">Select an Existing Stock</h2>
      </div>
       {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}
      <div className="min-h-[200px]">
        {renderContent()}
      </div>
    </div>
  );
};

export default StockFolderList;
