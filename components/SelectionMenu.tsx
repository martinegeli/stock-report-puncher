import React, { useState } from 'react';
import { FolderPlusIcon, FolderIcon, DocumentIcon } from './Icons';
import { DataFrequency } from '../types';

interface SelectionMenuProps {
  onAddNew: () => void;
  onUpdateExisting: () => void;
  onProcessFromDrive: (frequency: DataFrequency) => void;
}

const SelectionMenu: React.FC<SelectionMenuProps> = ({ onAddNew, onUpdateExisting, onProcessFromDrive }) => {
  const [selectedFrequency, setSelectedFrequency] = useState<DataFrequency>('annual');
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);

  const handleProcessFromDrive = () => {
    setShowFrequencyModal(true);
  };

  const handleFrequencySelect = (frequency: DataFrequency) => {
    setSelectedFrequency(frequency);
    setShowFrequencyModal(false);
    onProcessFromDrive(frequency);
  };

  return (
    <>
      <div className="bg-white p-8 rounded-lg shadow-lg border border-slate-200 w-full max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">Welcome!</h2>
        <p className="text-center text-slate-600 mb-8">How would you like to get started?</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={onAddNew}
            className="group flex flex-col items-center justify-center p-6 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-300"
          >
            <FolderPlusIcon className="h-12 w-12 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            <span className="mt-3 text-lg font-semibold text-slate-700 group-hover:text-indigo-600">Add a New Stock</span>
            <span className="mt-1 text-xs text-slate-500 text-center">Create a new folder for a stock ticker.</span>
          </button>
          <button
            onClick={onUpdateExisting}
            className="group flex flex-col items-center justify-center p-6 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-300"
          >
            <FolderIcon className="h-12 w-12 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            <span className="mt-3 text-lg font-semibold text-slate-700 group-hover:text-indigo-600">Update Existing</span>
            <span className="mt-1 text-xs text-slate-500 text-center">Add a new statement to a stock folder.</span>
          </button>
          <button
            onClick={handleProcessFromDrive}
            className="group flex flex-col items-center justify-center p-6 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 hover:border-green-500 hover:bg-green-50 transition-all duration-300"
          >
            <DocumentIcon className="h-12 w-12 text-slate-400 group-hover:text-green-500 transition-colors" />
            <span className="mt-3 text-lg font-semibold text-slate-700 group-hover:text-green-600">Process from Drive</span>
            <span className="mt-1 text-xs text-slate-500 text-center">Select PDFs from INPUT folders to process.</span>
          </button>
        </div>
      </div>

      {showFrequencyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl border border-slate-200 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Select Data Frequency</h3>
            <p className="text-slate-600 mb-6">Choose whether you want to process annual or quarterly financial data:</p>
            <div className="space-y-3">
              <button
                onClick={() => handleFrequencySelect('annual')}
                className="w-full p-4 text-left bg-slate-50 rounded-lg border-2 border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-300"
              >
                <div className="font-semibold text-slate-700">Annual Data</div>
                <div className="text-sm text-slate-500">Process yearly financial statements</div>
              </button>
              <button
                onClick={() => handleFrequencySelect('quarterly')}
                className="w-full p-4 text-left bg-slate-50 rounded-lg border-2 border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-300"
              >
                <div className="font-semibold text-slate-700">Quarterly Data</div>
                <div className="text-sm text-slate-500">Process quarterly financial statements</div>
              </button>
            </div>
            <button
              onClick={() => setShowFrequencyModal(false)}
              className="w-full mt-4 p-2 text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default SelectionMenu;
