
import React, { useState, useCallback, useEffect } from 'react';
import { FinancialDataItem, AppView, GoogleAuthStatus, StockFolder } from './types';
import { useGoogleApiLoader } from './hooks/useGoogleApiLoader';
import { extractFinancialDataFromPdf } from './services/geminiService';
import { getReadmeDocContent, getSheetData } from './services/googleService';
import { 
  initGoogleClient, 
  handleSignIn, 
  listStockFolders, 
  createStockFolder,
  appendToSheet
} from './services/googleService';
import { ResetIcon } from './components/Icons';
import Loader from './components/Loader';
import DataTable from './components/DataTable';
import StockFolderList from './components/StockFolderList';
import NewStockForm from './components/NewStockForm';
import UploadView from './components/UploadView';
import SelectionMenu from './components/SelectionMenu';
import { GoogleIcon, AlertTriangleIcon } from './components/Icons';


const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.AUTHENTICATING);
  const [googleAuthStatus, setGoogleAuthStatus] = useState<GoogleAuthStatus>(GoogleAuthStatus.LOADING);
  const [stockFolders, setStockFolders] = useState<StockFolder[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockFolder | null>(null);
  const [isFoldersLoading, setIsFoldersLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [extractedData, setExtractedData] = useState<FinancialDataItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaveSuccess, setIsSaveSuccess] = useState(false);
  
  const { isReady: areGoogleApisReady, isLoading: areGoogleApisLoading, error: googleApiLoaderError } = useGoogleApiLoader();

  const resetError = () => setError(null);

  useEffect(() => {
    // If the loader hook fails, set the app to a permanent error state.
    if (googleApiLoaderError) {
      setGoogleAuthStatus(GoogleAuthStatus.ERROR);
      setView(AppView.ERROR);
      setError(`Could not load required Google scripts: ${googleApiLoaderError}`);
      return;
    }

    // Once the scripts are ready, proceed with client initialization.
    if (areGoogleApisReady) {
      const updateAuthStatus = (isSignedIn: boolean) => {
        setGoogleAuthStatus(isSignedIn ? GoogleAuthStatus.SIGNED_IN : GoogleAuthStatus.SIGNED_OUT);
        if (isSignedIn) {
          setView(AppView.SELECTION_MENU);
        } else {
          // Stay on the authenticating view to show the sign-in button
          setView(AppView.AUTHENTICATING);
        }
      };
      
      initGoogleClient(updateAuthStatus).catch(err => {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error("Error initializing Google Client:", errorMessage);
        setGoogleAuthStatus(GoogleAuthStatus.ERROR);
        setView(AppView.ERROR);
        setError(errorMessage);
      });
    }
  }, [areGoogleApisReady, googleApiLoaderError]);

  const handleShowExistingStocks = async () => {
    resetError();
    setIsFoldersLoading(true);
    setView(AppView.EXISTING_STOCK_LIST);
    try {
      const folders = await listStockFolders();
      setStockFolders(folders);
    } catch (err) {
      handleError(err, "Could not retrieve stock folders from Google Drive.");
    } finally {
      setIsFoldersLoading(false);
    }
  };

  const handleCreateNewStock = async (ticker: string) => {
    resetError();
    setIsFoldersLoading(true);
    try {
      const newFolder = await createStockFolder(ticker);
      setSelectedStock(newFolder);
      setView(AppView.UPLOADING);
    } catch (err) {
      handleError(err, `Failed to create a folder for ticker "${ticker}".`);
      setView(AppView.NEW_STOCK_FORM); // Go back to the form on error
    } finally {
      setIsFoldersLoading(false);
    }
  };

  const handleError = (err: unknown, fallbackMessage: string) => {
    const errorMessage = err instanceof Error ? err.message : fallbackMessage;
    setError(errorMessage);
    // Keep the current view but show an error message
  };
  
  const handleProcessFile = useCallback(async () => {
    if (files.length === 0 || !selectedStock) {
      setError('No files or stock selected.');
      return;
    }

    setView(AppView.PROCESSING);
    resetError();
    setExtractedData([]);

    try {
      // Fetch README Google Doc content for context
      const readmeDocContent = await getReadmeDocContent();
      // Fetch existing sheet data for context
      const existingSheet = selectedStock.sheetId ? await getSheetData(selectedStock.sheetId) : [];
      // Call Gemini with all context
      const data = await extractFinancialDataFromPdf(files, readmeDocContent, existingSheet);
      setExtractedData(data);
      setView(AppView.SUCCESS);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to process the document. ${errorMessage}`);
      setView(AppView.ERROR);
    }
  }, [files, selectedStock]);

  const handleAppendData = async () => {
    if (!selectedStock || !selectedStock.sheetId || extractedData.length === 0 || files.length === 0) {
      setError('Cannot save. Missing data, files, or sheet ID.');
      return;
    }
    setIsSaving(true);
    resetError();
    try {
      // Read the current sheet data again to avoid race conditions
      const currentSheet = await getSheetData(selectedStock.sheetId);
      // Build a set of existing periods and lineItems
      const existingPeriods = currentSheet[0]?.slice(1) || [];
      const existingLineItems = new Set(currentSheet.slice(1).map(row => row[0]));
      // Prepare new rows for only new data
      const newRows: string[][] = [];
      for (const item of extractedData) {
        const { lineItem, ...periods } = item;
        // If the lineItem is new, add the whole row
        if (!existingLineItems.has(lineItem)) {
          const row = [lineItem, ...existingPeriods.map(p => periods[p] || '')];
          // Add any new periods not in existingPeriods
          for (const period of Object.keys(periods)) {
            if (!existingPeriods.includes(period)) {
              row.push(periods[period]);
            }
          }
          newRows.push(row);
        } else {
          // If the lineItem exists, only add new periods
          const rowIdx = currentSheet.findIndex(row => row[0] === lineItem);
          if (rowIdx !== -1) {
            for (const period of Object.keys(periods)) {
              if (!existingPeriods.includes(period)) {
                // Add a new value for this period
                const row = Array(currentSheet[0].length).fill('');
                row[0] = lineItem;
                row[currentSheet[0].length] = periods[period];
                newRows.push(row);
              }
            }
          }
        }
      }
      if (newRows.length === 0) {
        setIsSaveSuccess(true);
        return;
      }
      // Append only new rows
      await appendToSheet(newRows, selectedStock.sheetId);
      setIsSaveSuccess(true);
    } catch (err) {
      handleError(err, 'An unexpected error occurred while saving to Google Sheets.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartOver = () => {
    setView(AppView.SELECTION_MENU);
    setSelectedStock(null);
    setFiles([]);
    setExtractedData([]);
    setError(null);
    setIsSaveSuccess(false);
  };

  const handleResetForNewUpload = () => {
     setView(AppView.UPLOADING);
     setFiles([]);
     setExtractedData([]);
     setError(null);
     setIsSaveSuccess(false);
  };

  const renderContent = () => {
    // Centralized loading state while Google scripts are being fetched.
    if (areGoogleApisLoading) {
      return (
        <div className="text-center">
          <Loader />
          <p className="text-lg font-medium text-slate-600 mt-4">Connecting to Google Services...</p>
        </div>
      );
    }

    switch (view) {
      case AppView.AUTHENTICATING:
        return (
          <div className="text-center">
            {googleAuthStatus === GoogleAuthStatus.LOADING && <Loader />}
            {googleAuthStatus === GoogleAuthStatus.SIGNED_OUT && (
               <div className="flex flex-col items-center gap-4">
                  <p className="font-semibold text-slate-600">Please sign in to continue.</p>
                  <button
                    onClick={handleSignIn}
                    className="inline-flex items-center gap-3 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-md hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                    <GoogleIcon className="h-5 w-5" />
                    Sign in with Google
                  </button>
               </div>
            )}
          </div>
        );

      case AppView.SELECTION_MENU:
        return (
          <SelectionMenu
            onAddNew={() => setView(AppView.NEW_STOCK_FORM)}
            onUpdateExisting={handleShowExistingStocks}
          />
        );
      
      case AppView.NEW_STOCK_FORM:
        return (
          <NewStockForm 
            onSubmit={handleCreateNewStock} 
            onBack={handleStartOver}
            isLoading={isFoldersLoading}
            error={error}
            />
        );

      case AppView.EXISTING_STOCK_LIST:
        return (
          <StockFolderList
            folders={stockFolders}
            isLoading={isFoldersLoading}
            onSelectStock={(stock) => {
              setSelectedStock(stock);
              setView(AppView.UPLOADING);
            }}
            onBack={handleStartOver}
            error={error}
          />
        );
      
      case AppView.UPLOADING:
        if (!selectedStock) {
           setError("No stock selected. Returning to menu.");
           setView(AppView.SELECTION_MENU);
           return null;
        }
        return (
          <UploadView 
            stock={selectedStock}
            files={files}
            onFileChange={setFiles}
            onProcess={handleProcessFile}
            onBack={handleStartOver}
          />
        );
      
      case AppView.PROCESSING:
        return (
          <div className="text-center">
            <Loader />
            <p className="text-lg font-medium text-slate-600 mt-4">Analyzing your document for {selectedStock?.name}...</p>
            <p className="text-sm text-slate-500">This may take a moment. The AI is meticulously checking every number.</p>
          </div>
        );
      
      case AppView.SUCCESS:
        if (!selectedStock) return null; // Should not happen
        return (
          <DataTable
            data={extractedData}
            onReset={handleStartOver}
            onAppend={handleAppendData}
            isSaving={isSaving}
            isSaveSuccess={isSaveSuccess}
            sheetUrl={selectedStock.sheetUrl}
            onUploadNew={handleResetForNewUpload}
            stockName={selectedStock.name}
          />
        );
      
      case AppView.ERROR:
        return (
          <div className="text-center bg-red-50 border border-red-200 p-6 rounded-lg">
            <AlertTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-lg font-semibold text-red-800">An Error Occurred</h3>
            <p className="mt-2 text-sm text-red-700 whitespace-pre-wrap text-left">{error}</p>
            <button
              onClick={handleStartOver}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <ResetIcon className="h-5 w-5" />
              Start Over
            </button>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-4 sm:p-6 lg:p-8">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold text-slate-800">Financial Data Puncher</h1>
        <p className="mt-2 text-lg text-slate-600">Your personal AI assistant for organizing financial statements in Google Drive.</p>
      </header>
      <main className="flex-grow flex items-center justify-center">
        <div className="w-full max-w-4xl">
          {renderContent()}
        </div>
      </main>
      <footer className="text-center mt-10 text-sm text-slate-500">
        <p>Built with React, Gemini, and Google Drive.</p>
      </footer>
    </div>
  );
};

export default App;
