
import React, { useState, useCallback, useEffect } from 'react';
import { FinancialDataItem, AppView, GoogleAuthStatus, StockFolder, DriveFile, OutputFolder } from './types';
import { useGoogleApiLoader } from './hooks/useGoogleApiLoader';
import { extractFinancialDataFromPdf, processLlamaParseResults } from './services/geminiService';
import { getSheetData } from './services/googleService';
import { processPdfBatch, BatchProcessingProgress, LlamaParseResult } from './services/llamaParseService';
import { addProcessedFile } from './services/processedFilesService';
import { 
  initGoogleClient, 
  handleSignIn, 
  listStockFolders, 
  createStockFolder,
  appendToSheet,
  updateSheetCells,
  listInputPdfs,
  listOutputFolders,
  downloadPdfFromDrive
} from './services/googleService';
import { ResetIcon } from './components/Icons';
import Loader from './components/Loader';
import DataTable from './components/DataTable';
import StockFolderList from './components/StockFolderList';
import NewStockForm from './components/NewStockForm';
import UploadView from './components/UploadView';
import SelectionMenu from './components/SelectionMenu';
import OutputOverview from './components/OutputOverview';
import DriveFileSelection from './components/DriveFileSelection';
import ProcessingProgress from './components/ProcessingProgress';
import LlamaParseReview from './components/LlamaParseReview';
import { GoogleIcon, AlertTriangleIcon } from './components/Icons';


const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.AUTHENTICATING);
  const [googleAuthStatus, setGoogleAuthStatus] = useState<GoogleAuthStatus>(GoogleAuthStatus.LOADING);
  const [stockFolders, setStockFolders] = useState<StockFolder[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockFolder | null>(null);
  const [isFoldersLoading, setIsFoldersLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [extractedData, setExtractedData] = useState<FinancialDataItem[]>([]);
  const [rawGeminiOutput, setRawGeminiOutput] = useState<string>('');
  const [processingStats, setProcessingStats] = useState<{
    filesProcessed: number;
    lineItemsFound: number;
    periodsFound: number;
    processingTime: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaveSuccess, setIsSaveSuccess] = useState(false);
  const [outputFolders, setOutputFolders] = useState<OutputFolder[]>([]);
  const [inputFiles, setInputFiles] = useState<DriveFile[]>([]);
  const [selectedDriveFiles, setSelectedDriveFiles] = useState<DriveFile[]>([]);
  const [isLoadingOutputs, setIsLoadingOutputs] = useState(false);
  const [isLoadingInputFiles, setIsLoadingInputFiles] = useState(false);
  const [selectedStockName, setSelectedStockName] = useState<string>('');
  const [llamaParseProgress, setLlamaParseProgress] = useState<BatchProcessingProgress | null>(null);
  const [llamaParseResults, setLlamaParseResults] = useState<LlamaParseResult[]>([]);
  const [currentProcessingStage, setCurrentProcessingStage] = useState<'llamaparse' | 'gemini' | 'saving'>('llamaparse');
  const [hasExistingSheet, setHasExistingSheet] = useState<boolean>(false);
  
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
    setRawGeminiOutput('');
    setProcessingStats(null);

    try {
      // Fetch existing sheet data for context
      const existingSheet = selectedStock.sheetId ? await getSheetData(selectedStock.sheetId) : [];
      
      // Determine operation type based on whether there's existing data
      const operationType = existingSheet.length > 1 ? 'update' : 'create';
      console.log(`Operation type: ${operationType} (existing sheet rows: ${existingSheet.length})`);
      
      // Call Gemini with context
      const result = await extractFinancialDataFromPdf(files, existingSheet, operationType);
      setExtractedData(result.data);
      setRawGeminiOutput(result.rawOutput);
      setProcessingStats(result.stats);
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
      
      // Determine if this is a create or update operation
      const isUpdate = currentSheet.length > 1;
      
      if (isUpdate) {
        // UPDATE MODE: Add new columns to existing rows
        await handleUpdateMode(currentSheet);
      } else {
        // CREATE MODE: Add new rows
        await handleCreateMode(currentSheet);
      }
      
      setIsSaveSuccess(true);
    } catch (err) {
      handleError(err, 'An unexpected error occurred while saving to Google Sheets.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateMode = async (currentSheet: string[][]) => {
    // Determine all unique periods from extractedData
    const periodSet = new Set<string>();
    extractedData.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'lineItem') periodSet.add(key);
      });
    });
    const periods = Array.from(periodSet).sort();
    const headerRow = ['lineItem', ...periods];

    // Write the header row
    await updateSheetCells([
      { range: `A1:${String.fromCharCode(65 + periods.length)}1`, values: [headerRow] }
    ], selectedStock!.sheetId!);

    // Prepare data rows in the same order as the header
    const newRows: string[][] = extractedData.map(item => {
      return [item.lineItem, ...periods.map(period => item[period] || '')];
    });

    if (newRows.length === 0) {
      return;
    }

    // Write data rows starting from row 2
    await updateSheetCells(
      newRows.map((row, idx) => ({
        range: `A${idx + 2}:${String.fromCharCode(65 + periods.length)}${idx + 2}`,
        values: [row]
      })),
      selectedStock!.sheetId!
    );
  };

  const handleUpdateMode = async (currentSheet: string[][]) => {
    // For update mode, we add new columns to existing rows in batches
    const existingPeriods = currentSheet[0]?.slice(1) || [];
    const existingLineItems = currentSheet.slice(1).map(row => row[0]);
    
    // Find new periods that need to be added
    const newPeriods = new Set<string>();
    extractedData.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'lineItem' && !existingPeriods.includes(key)) {
          newPeriods.add(key);
        }
      });
    });
    
    if (newPeriods.size === 0) {
      console.log('No new periods to add');
      return;
    }
    
    // Sort new periods chronologically
    const sortedNewPeriods = Array.from(newPeriods).sort();
    const BATCH_SIZE = 10;
    for (let i = 0; i < sortedNewPeriods.length; i += BATCH_SIZE) {
      const batchPeriods = sortedNewPeriods.slice(i, i + BATCH_SIZE);
      const batchStartColIndex = existingPeriods.length + 1 + i; // +1 for lineItem col, +i for previous batches
      const batchEndColIndex = batchStartColIndex + batchPeriods.length - 1;
      const headerRange = `${String.fromCharCode(65 + batchStartColIndex)}1:${String.fromCharCode(65 + batchEndColIndex)}1`;
      const updates: { range: string; values: string[][] }[] = [];
      // Add new period headers to the header row for this batch
      updates.push({
        range: headerRange,
        values: [batchPeriods]
      });
      // Add values for each existing line item for this batch
      existingLineItems.forEach((lineItem, rowIndex) => {
        const extractedItem = extractedData.find(item => item.lineItem === lineItem);
        if (extractedItem) {
          const newValues = batchPeriods.map(period => extractedItem[period] || '');
          if (newValues.some(value => value !== '')) {
            const dataRowIndex = rowIndex + 2; // +2 because we start from row 2 (after header)
            const dataRange = `${String.fromCharCode(65 + batchStartColIndex)}${dataRowIndex}:${String.fromCharCode(65 + batchEndColIndex)}${dataRowIndex}`;
            updates.push({
              range: dataRange,
              values: [newValues]
            });
          }
        }
      });
      if (updates.length > 0) {
        await updateSheetCells(updates, selectedStock!.sheetId!);
      }
    }
  };

  const handleStartOver = () => {
    setView(AppView.SELECTION_MENU);
    setSelectedStock(null);
    setFiles([]);
    setExtractedData([]);
    setRawGeminiOutput('');
    setProcessingStats(null);
    setError(null);
    setIsSaveSuccess(false);
    setOutputFolders([]);
    setInputFiles([]);
    setSelectedDriveFiles([]);
    setSelectedStockName('');
    setLlamaParseProgress(null);
    setLlamaParseResults([]);
    setCurrentProcessingStage('llamaparse');
    setHasExistingSheet(false);
  };

  const handleResetForNewUpload = () => {
     setView(AppView.UPLOADING);
     setFiles([]);
     setExtractedData([]);
     setRawGeminiOutput('');
     setProcessingStats(null);
     setError(null);
     setIsSaveSuccess(false);
  };

  const handleShowOutputOverview = async () => {
    resetError();
    setIsLoadingOutputs(true);
    setView(AppView.OUTPUT_OVERVIEW);
    try {
      const folders = await listOutputFolders();
      setOutputFolders(folders);
    } catch (err) {
      handleError(err, "Could not retrieve OUTPUT folders from Google Drive.");
    } finally {
      setIsLoadingOutputs(false);
    }
  };

  const handleSelectStockFromOutput = async (stockName: string) => {
    resetError();
    setSelectedStockName(stockName);
    setIsLoadingInputFiles(true);
    setView(AppView.DRIVE_FILE_SELECTION);
    try {
      const files = await listInputPdfs(stockName);
      setInputFiles(files);
    } catch (err) {
      handleError(err, `Could not retrieve PDF files from INPUT/${stockName}.`);
    } finally {
      setIsLoadingInputFiles(false);
    }
  };

  const handleToggleDriveFile = (file: DriveFile) => {
    setSelectedDriveFiles(prev => {
      const exists = prev.find(f => f.id === file.id);
      if (exists) {
        return prev.filter(f => f.id !== file.id);
      } else {
        return [...prev, file];
      }
    });
  };

  const handleProcessDriveFiles = useCallback(async () => {
    if (selectedDriveFiles.length === 0 || !selectedStockName) {
      setError('No files selected or stock name missing.');
      return;
    }

    setView(AppView.PROCESSING);
    resetError();
    setExtractedData([]);
    setRawGeminiOutput('');
    setProcessingStats(null);
    setLlamaParseProgress(null);
    setLlamaParseResults([]);
    setCurrentProcessingStage('llamaparse');
    setHasExistingSheet(false);

    try {
      // STAGE 1: Download PDFs from Google Drive
      console.log('Downloading PDFs from Google Drive...');
      const downloadedFiles = await Promise.all(
        selectedDriveFiles.map(driveFile => 
          downloadPdfFromDrive(driveFile.id, driveFile.name)
        )
      );

      // STAGE 2: Check for existing sheet to inform user choices
      const existingStock = stockFolders.find(folder => 
        folder.name.toLowerCase() === selectedStockName.toLowerCase()
      );
      
      let existingSheet: string[][] = [];
      if (existingStock?.sheetId) {
        existingSheet = await getSheetData(existingStock.sheetId);
      }
      
      const hasExisting = existingSheet.length > 1;
      setHasExistingSheet(hasExisting);
      
      // Set the selected stock early for later use
      if (existingStock) {
        setSelectedStock(existingStock);
      }

      // STAGE 3: Process with LlamaParse (batch up to 10 files)
      console.log('Processing PDFs with LlamaParse...');
      setCurrentProcessingStage('llamaparse');
      
      const parseResults = await processPdfBatch(downloadedFiles, (progress) => {
        setLlamaParseProgress(progress);
      });
      
      setLlamaParseResults(parseResults);
      
      // Check if any files failed
      const successfulResults = parseResults.filter(r => r.status === 'completed' && r.jsonData);
      if (successfulResults.length === 0) {
        throw new Error('All PDF parsing failed. Please check your files and try again.');
      }

      if (successfulResults.length < parseResults.length) {
        console.warn(`${parseResults.length - successfulResults.length} files failed to parse`);
      }

      // PAUSE HERE: Go to review stage instead of continuing automatically
      console.log('LlamaParse completed. Moving to review stage...');
      setView(AppView.LLAMAPARSE_REVIEW);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to process the documents. ${errorMessage}`);
      setView(AppView.ERROR);
    }
  }, [selectedDriveFiles, selectedStockName, stockFolders]);

  const handleProceedToGemini = useCallback(async (operationType: 'create' | 'update') => {
    setView(AppView.PROCESSING);
    setCurrentProcessingStage('gemini');
    resetError();

    try {
      // Get successful results from LlamaParse
      const successfulResults = llamaParseResults.filter(r => r.status === 'completed' && r.jsonData);
      
      if (successfulResults.length === 0) {
        throw new Error('No successful LlamaParse results to process.');
      }

      // Get existing sheet data (we already have selectedStock set from earlier)
      let existingSheet: string[][] = [];
      if (selectedStock?.sheetId) {
        existingSheet = await getSheetData(selectedStock.sheetId);
      }
      
      console.log(`Processing with Gemini in ${operationType.toUpperCase()} mode`);
      
      // Process with Gemini using the new LlamaParse workflow
      const result = await processLlamaParseResults(successfulResults, existingSheet, operationType);
      setExtractedData(result.data);
      setRawGeminiOutput(result.rawOutput);
      setProcessingStats(result.stats);

      // Track processed files
      console.log('Tracking processed files...');
      successfulResults.forEach(result => {
        const driveFile = selectedDriveFiles.find(f => f.name === result.fileName);
        if (driveFile) {
          addProcessedFile({
            fileId: driveFile.id,
            fileName: result.fileName,
            stockName: selectedStockName,
            status: 'processed',
            llamaParseJobId: result.id
          });
        }
      });
      
      setView(AppView.SUCCESS);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to process with Gemini. ${errorMessage}`);
      setView(AppView.ERROR);
    }
  }, [llamaParseResults, selectedStock, selectedDriveFiles, selectedStockName]);

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
            onProcessFromDrive={handleShowOutputOverview}
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

      case AppView.OUTPUT_OVERVIEW:
        return (
          <OutputOverview
            outputFolders={outputFolders}
            isLoading={isLoadingOutputs}
            onSelectStock={handleSelectStockFromOutput}
            onBack={handleStartOver}
            error={error}
          />
        );

      case AppView.DRIVE_FILE_SELECTION:
        return (
          <DriveFileSelection
            stockName={selectedStockName}
            inputFiles={inputFiles}
            isLoadingFiles={isLoadingInputFiles}
            selectedFiles={selectedDriveFiles}
            onFileToggle={handleToggleDriveFile}
            onProcess={handleProcessDriveFiles}
            onBack={handleShowOutputOverview}
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
        if (llamaParseProgress) {
          return (
            <ProcessingProgress
              progress={llamaParseProgress}
              currentStage={currentProcessingStage}
              onCancel={() => {
                console.log('Processing cancelled by user');
                setView(AppView.DRIVE_FILE_SELECTION);
              }}
            />
          );
        } else {
          return (
            <div className="text-center">
              <Loader />
              <p className="text-lg font-medium text-slate-600 mt-4">
                {selectedStock?.name ? 
                  `Analyzing your documents for ${selectedStock.name}...` :
                  `Analyzing your documents for ${selectedStockName}...`
                }
              </p>
              <p className="text-sm text-slate-500">This may take a moment. We're processing your PDFs with LlamaParse...</p>
            </div>
          );
        }

      case AppView.LLAMAPARSE_REVIEW:
        return (
          <LlamaParseReview
            results={llamaParseResults}
            stockName={selectedStockName}
            hasExistingSheet={hasExistingSheet}
            onProceedToGemini={handleProceedToGemini}
            onBack={() => setView(AppView.DRIVE_FILE_SELECTION)}
          />
        );
      
      case AppView.SUCCESS:
        if (!selectedStock) return null; // Should not happen
        return (
          <DataTable
            data={extractedData}
            rawGeminiOutput={rawGeminiOutput}
            processingStats={processingStats}
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
    <div className="min-h-screen bg-gray-900 flex flex-col p-4 sm:p-6 lg:p-8">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-100">Financial Data Puncher</h1>
        <p className="mt-2 text-lg text-gray-300">Your personal AI assistant for organizing financial statements in Google Drive.</p>
      </header>
      <main className="flex-grow flex items-center justify-center">
        <div className="w-full max-w-4xl">
          {renderContent()}
        </div>
      </main>
      <footer className="text-center mt-10 text-sm text-gray-400">
        <p>Built with React, Gemini, and Google Drive.</p>
      </footer>
    </div>
  );
};

export default App;
