export interface FinancialDataItem {
  period: string;
  lineItem: string;
  value: string;
  sourceDocument?: string;
}

export interface StockFolder {
  id: string;
  name: string;
  sheetId?: string;
  sheetUrl?: string;
}

export enum AppView {
  AUTHENTICATING,
  SELECTION_MENU,
  EXISTING_STOCK_LIST,
  NEW_STOCK_FORM,
  UPLOADING,
  OUTPUT_OVERVIEW,
  DRIVE_FILE_SELECTION,
  PROCESSING,
  LLAMAPARSE_REVIEW,
  SUCCESS,
  ERROR,
}

export enum GoogleAuthStatus {
  LOADING,
  SIGNED_IN,
  SIGNED_OUT,
  ERROR,
}

export interface DriveFile {
  id: string;
  name: string;
}

export interface OutputFolder {
  stockName: string;
  files: DriveFile[];
}

// Storage interfaces for intermediate data
export interface ParsedFinancialDocument {
  id: string;
  fileName: string;
  companyName?: string;
  documentType: 'income_statement' | 'balance_sheet' | 'cash_flow' | 'notes' | 'annual_report' | 'unknown';
  periods: string[];
  rawData: any; // Raw extracted data from llama parsing
  parsedAt: Date;
  sourceFileId?: string; // Google Drive file ID if from Drive
  metadata: {
    pageCount?: number;
    extractionMethod: 'llama' | 'gemini' | 'manual';
    confidence?: number;
  };
}

export interface FinancialDataStorage {
  sessionId: string;
  companyName: string;
  stockTicker?: string;
  documents: ParsedFinancialDocument[];
  existingSheetData?: string[][]; // Current sheet context
  createdAt: Date;
  updatedAt: Date;
  status: 'parsing' | 'ready_for_gemini' | 'processing_with_gemini' | 'completed' | 'error';
}

export interface StorageOperationResult {
  success: boolean;
  message: string;
  data?: any;
}
