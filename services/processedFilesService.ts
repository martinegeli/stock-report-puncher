export interface ProcessedFileRecord {
  fileId: string;
  fileName: string;
  stockName: string;
  processedAt: Date;
  llamaParseJobId?: string;
  status: 'processed' | 'failed';
  errorMessage?: string;
  fileHash?: string; // Optional: for detecting file changes
}

const STORAGE_KEY = 'financial-data-puncher-processed-files';

/**
 * Retrieves all processed file records from localStorage
 */
export const getProcessedFiles = (): ProcessedFileRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    // Convert date strings back to Date objects
    return parsed.map((record: any) => ({
      ...record,
      processedAt: new Date(record.processedAt)
    }));
  } catch (error) {
    console.error('Error reading processed files from localStorage:', error);
    return [];
  }
};

/**
 * Saves processed file records to localStorage
 */
const saveProcessedFiles = (records: ProcessedFileRecord[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('Error saving processed files to localStorage:', error);
  }
};

/**
 * Adds a new processed file record
 */
export const addProcessedFile = (record: Omit<ProcessedFileRecord, 'processedAt'>): void => {
  const records = getProcessedFiles();
  const newRecord: ProcessedFileRecord = {
    ...record,
    processedAt: new Date()
  };
  
  // Remove any existing record with the same fileId to avoid duplicates
  const filteredRecords = records.filter(r => r.fileId !== record.fileId);
  filteredRecords.push(newRecord);
  
  saveProcessedFiles(filteredRecords);
};

/**
 * Checks if a file has been processed before
 */
export const isFileProcessed = (fileId: string): boolean => {
  const records = getProcessedFiles();
  return records.some(record => record.fileId === fileId && record.status === 'processed');
};

/**
 * Gets processed files for a specific stock
 */
export const getProcessedFilesForStock = (stockName: string): ProcessedFileRecord[] => {
  const records = getProcessedFiles();
  return records.filter(record => record.stockName.toLowerCase() === stockName.toLowerCase());
};

/**
 * Gets the processing history for a specific file
 */
export const getFileProcessingHistory = (fileId: string): ProcessedFileRecord[] => {
  const records = getProcessedFiles();
  return records.filter(record => record.fileId === fileId);
};

/**
 * Removes a processed file record (useful for reprocessing)
 */
export const removeProcessedFile = (fileId: string): void => {
  const records = getProcessedFiles();
  const filteredRecords = records.filter(r => r.fileId !== fileId);
  saveProcessedFiles(filteredRecords);
};

/**
 * Clears all processed file records (useful for debugging)
 */
export const clearAllProcessedFiles = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing processed files:', error);
  }
};

/**
 * Gets statistics about processed files
 */
export const getProcessingStats = (): {
  totalProcessed: number;
  totalFailed: number;
  stocksProcessed: string[];
  lastProcessedAt?: Date;
} => {
  const records = getProcessedFiles();
  const processed = records.filter(r => r.status === 'processed');
  const failed = records.filter(r => r.status === 'failed');
  const stocks = [...new Set(records.map(r => r.stockName))];
  const lastProcessed = records.length > 0 
    ? records.reduce((latest, record) => 
        record.processedAt > latest ? record.processedAt : latest, 
        records[0].processedAt
      )
    : undefined;

  return {
    totalProcessed: processed.length,
    totalFailed: failed.length,
    stocksProcessed: stocks,
    lastProcessedAt: lastProcessed
  };
};