import { LLAMAPARSE_API_KEY, LLAMAPARSE_BATCH_SIZE, PROCESSING_TIMEOUT } from '../config';

export interface LlamaParseResult {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  jsonData?: any;
  error?: string;
  processedAt?: Date;
}

export interface BatchProcessingProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile?: string;
  results: LlamaParseResult[];
  isComplete: boolean;
  hasErrors: boolean;
}

// Use local proxy server to avoid CORS issues
const LLAMAPARSE_BASE_URL = 'http://localhost:3001/api/llamaparse';

/**
 * Validates LlamaParse API configuration
 */
const validateLlamaParseConfig = () => {
  if (!LLAMAPARSE_API_KEY || LLAMAPARSE_API_KEY === 'YOUR_LLAMAPARSE_API_KEY_HERE') {
    throw new Error('LlamaParse API key is not configured. Please add VITE_LLAMAPARSE_API_KEY to your .env file.');
  }
  
  if (!LLAMAPARSE_API_KEY.startsWith('llx-')) {
    throw new Error('Invalid LlamaParse API key format. API key should start with "llx-"');
  }
  
  console.log('LlamaParse config validation passed. API key format:', LLAMAPARSE_API_KEY.substring(0, 10) + '...');
};

/**
 * Uploads a single PDF to LlamaParse for processing
 */
const uploadPdfToLlamaParse = async (file: File): Promise<{ job_id: string }> => {
  validateLlamaParseConfig();
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('language', 'en');
  formData.append('parsing_instruction', 'Extract all financial data, tables, and structured information. Preserve the original formatting and structure of financial statements, including headers, line items, and numerical values.');
  formData.append('result_type', 'json');
  formData.append('verbose', 'true');

  const response = await fetch(`${LLAMAPARSE_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('LlamaParse upload failed:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: errorText,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
    throw new Error(`LlamaParse upload failed: ${response.status} ${response.statusText}\nDetails: ${errorText}`);
  }

  return await response.json();
};

/**
 * Polls LlamaParse for job completion and retrieves results
 */
const pollLlamaParseJob = async (jobId: string, fileName: string): Promise<LlamaParseResult> => {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds
  
  while (Date.now() - startTime < PROCESSING_TIMEOUT) {
    try {
      const response = await fetch(`${LLAMAPARSE_BASE_URL}/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to check job status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status === 'SUCCESS') {
        return {
          id: jobId,
          fileName,
          status: 'completed',
          jsonData: result.result,
          processedAt: new Date(),
        };
      } else if (result.status === 'ERROR') {
        return {
          id: jobId,
          fileName,
          status: 'error',
          error: result.error || 'Unknown LlamaParse error',
          processedAt: new Date(),
        };
      }
      
      // Still processing, wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
    } catch (error) {
      console.error('Error polling LlamaParse job:', error);
      return {
        id: jobId,
        fileName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown polling error',
        processedAt: new Date(),
      };
    }
  }

  // Timeout
  return {
    id: jobId,
    fileName,
    status: 'error',
    error: 'Processing timeout exceeded',
    processedAt: new Date(),
  };
};

/**
 * Processes a batch of PDF files with LlamaParse (up to 10 files)
 * Returns a stream of progress updates
 */
export const processPdfBatch = async (
  files: File[],
  onProgress: (progress: BatchProcessingProgress) => void
): Promise<LlamaParseResult[]> => {
  if (files.length === 0) {
    throw new Error('No files provided for processing');
  }

  if (files.length > LLAMAPARSE_BATCH_SIZE) {
    throw new Error(`Too many files. Maximum batch size is ${LLAMAPARSE_BATCH_SIZE}, got ${files.length}`);
  }

  const results: LlamaParseResult[] = [];
  let processedCount = 0;

  // Initialize progress
  const updateProgress = () => {
    onProgress({
      totalFiles: files.length,
      processedFiles: processedCount,
      results: [...results],
      isComplete: processedCount === files.length,
      hasErrors: results.some(r => r.status === 'error'),
    });
  };

  updateProgress();

  // Process files sequentially to avoid overwhelming the API
  for (const file of files) {
    try {
      // Update current file being processed
      onProgress({
        totalFiles: files.length,
        processedFiles: processedCount,
        currentFile: file.name,
        results: [...results],
        isComplete: false,
        hasErrors: results.some(r => r.status === 'error'),
      });

      console.log(`Starting upload for: ${file.name}`);
      
      // Upload file to LlamaParse
      const uploadResult = await uploadPdfToLlamaParse(file);
      console.log(`Upload successful for ${file.name}, job ID: ${uploadResult.job_id}`);
      
      // Add pending result
      const pendingResult: LlamaParseResult = {
        id: uploadResult.job_id,
        fileName: file.name,
        status: 'processing',
      };
      results.push(pendingResult);
      updateProgress();
      
      // Poll for completion
      const finalResult = await pollLlamaParseJob(uploadResult.job_id, file.name);
      
      // Update the result in the array
      const resultIndex = results.findIndex(r => r.id === uploadResult.job_id);
      if (resultIndex !== -1) {
        results[resultIndex] = finalResult;
      }
      
      processedCount++;
      console.log(`Completed processing: ${file.name} (${processedCount}/${files.length})`);
      
      updateProgress();
      
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      
      const errorResult: LlamaParseResult = {
        id: `error-${Date.now()}-${Math.random()}`,
        fileName: file.name,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        processedAt: new Date(),
      };
      results.push(errorResult);
      processedCount++;
      
      updateProgress();
    }
  }

  console.log(`Batch processing complete. ${results.length} files processed.`);
  return results;
};

/**
 * Processes a single PDF file with LlamaParse
 */
export const processSinglePdf = async (file: File): Promise<LlamaParseResult> => {
  const results = await processPdfBatch([file], () => {});
  return results[0];
};