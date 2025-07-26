import { LLAMAPARSE_API_KEY, LLAMAPARSE_BATCH_SIZE, PROCESSING_TIMEOUT } from '../config';
import { PipelineProgress, PipelineFileResult, DriveFile } from '../types';

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
const uploadPdfToLlamaParse = async (file: File): Promise<{ id: string; status: string }> => {
  validateLlamaParseConfig();
  
  console.log('Preparing to upload file to LlamaParse:', {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified
  });
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('language', 'en');
  formData.append('parsing_instruction', 'Extract all tables from this document. Preserve table structures including headers, row labels, column headers, and all values. Maintain the original table formatting and hierarchical structure. Do not interpret or analyze the data - just extract the raw table content as structured data.');
  formData.append('result_type', 'json');
  formData.append('verbose', 'true');
  
  console.log('FormData created, uploading to:', LLAMAPARSE_BASE_URL + '/upload');

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
      
      console.log(`LlamaParse job ${jobId} status response:`, {
        status: result.status,
        hasResult: !!result.result,
        resultType: typeof result.result,
        resultKeys: result.result ? Object.keys(result.result) : [],
        allKeys: Object.keys(result),
        fullResponse: result,
        error: result.error,
        // Check for additional possible data fields
        hasPages: !!result.pages,
        hasContent: !!result.content,
        hasOutput: !!result.output,
        hasData: !!result.data,
        hasParsedText: !!result.parsed_text,
        hasJson: !!result.json,
        hasDocument: !!result.document
      });
      
      if (result.status === 'SUCCESS') {
        // The job is complete, now fetch the actual results
        console.log(`Job ${jobId} completed successfully. Fetching actual results...`);
        
        let jsonData = null;
        
        // First try to get data directly from the response in various possible fields
        if (result.result && typeof result.result === 'object' && Object.keys(result.result).length > 1) {
          // If result.result contains more than just an ID, use it
          jsonData = result.result;
          console.log('Using data from result.result');
        } else if (result.pages && Array.isArray(result.pages)) {
          // Check for pages array (common in document parsing APIs)
          jsonData = result.pages;
          console.log('Using data from result.pages');
        } else if (result.content) {
          // Check for content field
          jsonData = result.content;
          console.log('Using data from result.content');
        } else if (result.output) {
          // Check for output field
          jsonData = result.output;
          console.log('Using data from result.output');
        } else if (result.data) {
          // Check for data field
          jsonData = result.data;
          console.log('Using data from result.data');
        } else if (result.parsed_text) {
          // Check for parsed_text field
          jsonData = result.parsed_text;
          console.log('Using data from result.parsed_text');
        } else if (result.json) {
          // Check for json field
          jsonData = result.json;
          console.log('Using data from result.json');
        } else if (result.document) {
          // Check for document field
          jsonData = result.document;
          console.log('Using data from result.document');
        }
        // If no data found in direct fields, use the working markdown endpoint
        else {
          console.log('No data in job status response, fetching from markdown endpoint...');
          try {
            const markdownResponse = await fetch(`${LLAMAPARSE_BASE_URL}/job/${jobId}/result/markdown`, {
              headers: {
                'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`,
              },
            });
            
            if (markdownResponse.ok) {
              jsonData = await markdownResponse.json();
              console.log('✅ Successfully fetched from markdown endpoint');
            } else {
              console.error('❌ Markdown endpoint failed:', {
                status: markdownResponse.status,
                statusText: markdownResponse.statusText
              });
            }
          } catch (fetchError) {
            console.error('❌ Error fetching markdown result:', fetchError);
          }
        }
        
        console.log(`LlamaParse SUCCESS for ${fileName}:`, {
          fullResult: result,
          extractedJsonData: jsonData,
          hasJsonData: !!jsonData,
          jsonDataType: typeof jsonData,
          jsonDataLength: jsonData ? JSON.stringify(jsonData).length : 0,
          firstLevelKeys: jsonData && typeof jsonData === 'object' ? Object.keys(jsonData) : [],
          resultKeys: Object.keys(result)
        });
        
        return {
          id: jobId,
          fileName,
          status: 'completed',
          jsonData: jsonData,
          processedAt: new Date(),
        };
      } else if (result.status === 'ERROR') {
        console.error(`LlamaParse ERROR for ${fileName}:`, result.error);
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
      console.log(`Upload successful for ${file.name}, job ID: ${uploadResult.id}`);
      
      // Add pending result
      const pendingResult: LlamaParseResult = {
        id: uploadResult.id,
        fileName: file.name,
        status: 'processing',
      };
      results.push(pendingResult);
      updateProgress();
      
      // Poll for completion
      const finalResult = await pollLlamaParseJob(uploadResult.id, file.name);
      
      // Update the result in the array
      const resultIndex = results.findIndex(r => r.id === uploadResult.id);
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

/**
 * Enhanced sequential pipeline processing: File1(Download→LlamaParse→Gemini→Sheets) → File2(Download→LlamaParse→Gemini→Sheets) etc.
 * This function will be the orchestrator but will need external functions for Gemini and Sheets processing
 */
export const processFilesSequentialPipeline = async (
  driveFiles: DriveFile[],
  stockName: string,
  operationType: 'create' | 'update',
  onProgress: (progress: PipelineProgress) => void,
  // External processing functions (to avoid circular dependencies)
  downloadFn: (fileId: string, fileName: string) => Promise<File>,
  geminiProcessFn: (jsonData: any, existingSheet: string[][], operationType: 'create' | 'update') => Promise<{data: any[], rawOutput: string, stats: any}>,
  sheetsWriteFn: (data: any[], stockName: string) => Promise<void>,
  getExistingSheetFn: () => Promise<string[][]>
): Promise<{
  successfulFiles: string[];
  failedFiles: string[];
  allData: any[];
  totalStats: any;
}> => {
  
  if (driveFiles.length === 0) {
    throw new Error('No files provided for processing');
  }

  if (driveFiles.length > LLAMAPARSE_BATCH_SIZE) {
    throw new Error(`Too many files. Maximum batch size is ${LLAMAPARSE_BATCH_SIZE}, got ${driveFiles.length}`);
  }

  // Initialize file results
  const fileResults: PipelineFileResult[] = driveFiles.map(file => ({
    id: file.id,
    fileName: file.name,
    downloadStatus: 'pending',
    llamaParseStatus: 'pending', 
    geminiStatus: 'pending',
    sheetsStatus: 'pending'
  }));

  // Initialize progress
  const updateProgress = (currentFileIndex: number, currentStage: PipelineProgress['currentStage']) => {
    const stagesPerFile = 4; // download, llamaparse, gemini, sheets
    const completedStages = currentFileIndex * stagesPerFile + getCurrentStageWeight(currentStage);
    const totalStages = driveFiles.length * stagesPerFile;
    const overallProgress = Math.round((completedStages / totalStages) * 100);

    onProgress({
      totalFiles: driveFiles.length,
      currentFileIndex,
      currentFileName: currentFileIndex < driveFiles.length ? driveFiles[currentFileIndex].name : undefined,
      currentStage,
      fileResults: [...fileResults],
      overallProgress: Math.min(100, overallProgress),
      isComplete: currentFileIndex === driveFiles.length && currentStage === 'completed',
      hasErrors: fileResults.some(f => f.downloadStatus === 'error' || f.llamaParseStatus === 'error' || f.geminiStatus === 'error' || f.sheetsStatus === 'error')
    });
  };

  const getCurrentStageWeight = (stage: PipelineProgress['currentStage']): number => {
    switch (stage) {
      case 'download': return 0;
      case 'llamaparse': return 1;
      case 'gemini': return 2;
      case 'sheets': return 3;
      case 'completed': return 4;
      default: return 0;
    }
  };

  // Get existing sheet data once at the beginning
  let existingSheet: string[][] = [];
  try {
    existingSheet = await getExistingSheetFn();
  } catch (error) {
    console.log('No existing sheet found or error loading it, continuing with empty sheet');
  }

  const allData: any[] = [];
  const successfulFiles: string[] = [];
  const failedFiles: string[] = [];
  let totalStats = { filesProcessed: 0, lineItemsFound: 0, periodsFound: 0, processingTime: 0 };

  // Process each file sequentially through the entire pipeline
  for (let i = 0; i < driveFiles.length; i++) {
    const driveFile = driveFiles[i];
    const fileResult = fileResults[i];
    const startTime = Date.now();

    console.log(`\n=== Starting pipeline for file ${i + 1}/${driveFiles.length}: ${driveFile.name} ===`);

    try {
      // STAGE 1: Download PDF from Google Drive
      updateProgress(i, 'download');
      console.log(`[${i+1}/${driveFiles.length}] Downloading ${driveFile.name}...`);
      fileResult.downloadStatus = 'processing';
      
      const file = await downloadFn(driveFile.id, driveFile.name);
      fileResult.downloadStatus = 'completed';
      console.log(`[${i+1}/${driveFiles.length}] Download completed: ${file.size} bytes`);

      // STAGE 2: Process with LlamaParse
      updateProgress(i, 'llamaparse');
      console.log(`[${i+1}/${driveFiles.length}] Processing with LlamaParse...`);
      fileResult.llamaParseStatus = 'processing';
      
      const uploadResult = await uploadPdfToLlamaParse(file);
      fileResult.llamaParseJobId = uploadResult.id;
      
      const parseResult = await pollLlamaParseJob(uploadResult.id, driveFile.name);
      
      if (parseResult.status !== 'completed' || !parseResult.jsonData) {
        throw new Error(`LlamaParse failed: ${parseResult.error || 'Unknown error'}`);
      }
      
      fileResult.llamaParseStatus = 'completed';
      console.log(`[${i+1}/${driveFiles.length}] LlamaParse completed`);

      // STAGE 3: Process with Gemini
      updateProgress(i, 'gemini');
      console.log(`[${i+1}/${driveFiles.length}] Processing with Gemini...`);
      fileResult.geminiStatus = 'processing';
      
      const geminiResult = await geminiProcessFn(parseResult.jsonData, existingSheet, operationType);
      fileResult.geminiStatus = 'completed';
      console.log(`[${i+1}/${driveFiles.length}] Gemini processing completed: ${geminiResult.data.length} items extracted`);

      // STAGE 4: Write to Google Sheets (accumulate data first, write at the end for better performance)
      updateProgress(i, 'sheets');
      console.log(`[${i+1}/${driveFiles.length}] Preparing data for Sheets...`);
      fileResult.sheetsStatus = 'processing';
      
      // For now, just accumulate the data - we'll write to sheets at the end
      allData.push(...geminiResult.data);
      fileResult.sheetsStatus = 'completed';
      
      // Update statistics
      totalStats.filesProcessed++;
      totalStats.lineItemsFound += geminiResult.stats?.lineItemsFound || 0;
      totalStats.periodsFound += geminiResult.stats?.periodsFound || 0;
      
      fileResult.processingTimeMs = Date.now() - startTime;
      totalStats.processingTime += fileResult.processingTimeMs;
      
      successfulFiles.push(driveFile.name);
      console.log(`[${i+1}/${driveFiles.length}] ✅ Pipeline completed for ${driveFile.name} in ${fileResult.processingTimeMs}ms`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${i+1}/${driveFiles.length}] ❌ Pipeline failed for ${driveFile.name}:`, errorMessage);
      
      fileResult.error = errorMessage;
      
      // Mark current and remaining stages as error
      if (fileResult.downloadStatus === 'processing') fileResult.downloadStatus = 'error';
      if (fileResult.llamaParseStatus === 'processing') fileResult.llamaParseStatus = 'error';
      if (fileResult.geminiStatus === 'processing') fileResult.geminiStatus = 'error';
      if (fileResult.sheetsStatus === 'processing') fileResult.sheetsStatus = 'error';
      
      failedFiles.push(driveFile.name);
      
      // Update progress to show error
      updateProgress(i, 'gemini'); // Stay on current stage
    }
  }

  // FINAL STAGE: Write all accumulated data to Google Sheets
  if (allData.length > 0) {
    console.log(`\n=== Writing ${allData.length} items to Google Sheets ===`);
    updateProgress(driveFiles.length, 'sheets');
    
    try {
      await sheetsWriteFn(allData, stockName);
      console.log('✅ Successfully wrote all data to Google Sheets');
    } catch (error) {
      console.error('❌ Failed to write to Google Sheets:', error);
      // Don't throw here, as some files were processed successfully
    }
  }

  // Final progress update
  updateProgress(driveFiles.length, 'completed');
  
  console.log(`\n=== Pipeline Summary ===`);
  console.log(`Total files: ${driveFiles.length}`);
  console.log(`Successful: ${successfulFiles.length}`);
  console.log(`Failed: ${failedFiles.length}`);
  console.log(`Total processing time: ${totalStats.processingTime}ms`);

  return {
    successfulFiles,
    failedFiles,
    allData,
    totalStats
  };
};