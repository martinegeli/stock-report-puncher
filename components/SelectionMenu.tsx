import React from 'react';
import { FolderPlusIcon, FolderIcon } from './Icons';

interface SelectionMenuProps {
  onAddNew: () => void;
  onUpdateExisting: () => void;
}

const SelectionMenu: React.FC<SelectionMenuProps> = ({ onAddNew, onUpdateExisting }) => {
  return (
    <div className="bg-white p-8 rounded-lg shadow-lg border border-slate-200 w-full max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">Welcome!</h2>
      <p className="text-center text-slate-600 mb-8">How would you like to get started?</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={onAddNew}
          className="group flex flex-col items-center justify-center p-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-300"
        >
          <FolderPlusIcon className="h-16 w-16 text-slate-400 group-hover:text-indigo-500 transition-colors" />
          <span className="mt-4 text-xl font-semibold text-slate-700 group-hover:text-indigo-600">Add a New Stock</span>
          <span className="mt-1 text-sm text-slate-500">Create a new folder for a stock ticker.</span>
        </button>
        <button
          onClick={onUpdateExisting}
          className="group flex flex-col items-center justify-center p-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-300"
        >
          <FolderIcon className="h-16 w-16 text-slate-400 group-hover:text-indigo-500 transition-colors" />
          <span className="mt-4 text-xl font-semibold text-slate-700 group-hover:text-indigo-600">Update Existing</span>
          <span className="mt-1 text-sm text-slate-500">Add a new statement to a stock folder.</span>
        </button>
      </div>
    </div>
  );
};

export default SelectionMenu;
