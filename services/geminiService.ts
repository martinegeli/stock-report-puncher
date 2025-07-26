
import { GoogleGenAI, Type } from "@google/genai";
import { API_KEY } from '../config';
import type { FinancialDataItem, ParsedFinancialDocument } from '../types';
import { storageService } from './storageService';

// The API_KEY is sourced from the config.ts file.
const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string; } }> => {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("Failed to read file as data URL."));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
  const base64EncodedData = await base64EncodedDataPromise;
  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
};

// Enhanced schema: only require 'lineItem', allow any period as additional property
const TABLE_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      lineItem: { 
        type: Type.STRING, 
        description: "The name of the financial line item (e.g., 'Revenue', 'Net Income', 'Total Assets', 'Cash and Cash Equivalents')." 
      }
    },
    required: ["lineItem"],
    additionalProperties: { 
      type: Type.STRING,
      description: "A period (e.g., '2022', 'Q1 2023', etc.) with its corresponding value. Only include periods actually present in the PDFs."
    },
  },
};

/**
 * Extracts financial data from multiple PDFs using storage service for context.
 * This is the enhanced version that integrates with the storage system.
 * @param sessionId Storage session ID containing parsed documents and context
 * @returns Object with parsed data, raw output, and processing stats
 */
export const extractFinancialDataFromStorage = async (
  sessionId: string
): Promise<{
  data: any[];
  rawOutput: string;
  stats: {
    filesProcessed: number;
    lineItemsFound: number;
    periodsFound: number;
    processingTime: number;
  };
}> => {
  const startTime = Date.now();
  
  // Update session status
  storageService.updateStatus(sessionId, 'processing_with_gemini');
  
  try {
    const consolidatedData = storageService.getConsolidatedData(sessionId);
    if (!consolidatedData) {
      throw new Error('Session not found or contains no data');
    }

    const { documents, existingSheetData, operationType } = consolidatedData;
    
    // Create context from stored documents
    const documentContext = documents.map(doc => 
      `Document: ${doc.fileName} (${doc.documentType})\nPeriods: ${doc.periods.join(', ')}\nConfidence: ${doc.metadata.confidence || 'unknown'}`
    ).join('\n\n');

    // Convert existing sheet to markdown table for context
    let existingSheetTable = '';
    if (existingSheetData && existingSheetData.length > 0) {
      const header = '| ' + existingSheetData[0].join(' | ') + ' |\n';
      const sep = '| ' + existingSheetData[0].map(() => '---').join(' | ') + ' |\n';
      const rows = existingSheetData.slice(1).map(row => '| ' + row.join(' | ') + ' |').join('\n');
      existingSheetTable = header + sep + rows;
      console.log("Existing sheet data for context:", existingSheetTable);
    }

    // Use stored raw data instead of re-parsing PDFs if available
    const filePartsPromise = documents.map(async (doc) => {
      if (doc.rawData && typeof doc.rawData === 'object' && doc.rawData.inlineData) {
        // Already has parsed data from llama or previous processing
        return doc.rawData;
      } else {
        // Fall back to file processing if no raw data available
        throw new Error(`Document ${doc.fileName} has no raw data available for processing`);
      }
    });

    const fileParts = await Promise.all(filePartsPromise);
    
    console.log(`🔧 Using ${operationType.toUpperCase()} mode for Gemini processing with ${documents.length} stored documents`);

    // Enhanced prompts that leverage storage context
    let systemInstruction: string;
    let prompt: string;

    if (operationType === 'create') {
      systemInstruction = `You are an expert financial data extraction service for creating new financial datasets. You have access to pre-parsed financial documents with identified periods and document types. Your task is to extract ALL numerical values associated with each line item for income statement, balance sheet and cash flow. You MUST include the actual financial values for each period. Your most important characteristics are to be accurate and complete. Take your time and be thorough.`;

      prompt = `CREATE MODE: You are processing pre-parsed financial statement documents with the following context:

${documentContext}

Analyze the provided financial data and extract ALL line items with their corresponding numerical values and periods from any financial tables (Income Statements, Balance Sheets, Cash Flow Statements).

CRITICAL REQUIREMENTS:
1. Process ALL Documents: Use all provided parsed documents to build a comprehensive historical view.
2. Create Superset of Line Items: Create a standardized "superset" of all unique line items. Normalize terminology.
3. Chronological Columns: Arrange data with earliest period first and latest period last.
4. Standardize Values: Convert to consistent units (e.g., Millions), use minus signs for negatives.
5. Internal Verification: Verify Balance Sheet and Cash Flow accuracy.
6. Only include periods actually present in the documents.

Extract ALL financial data you can find, ensuring each line item has at least one period with a value.`;
    } else {
      systemInstruction = `You are an expert financial data extraction service for updating existing financial datasets. You have access to pre-parsed financial documents and existing sheet context. Focus on matching new data to existing line items and adding new time periods.`;

      prompt = `UPDATE MODE: You are processing pre-parsed financial documents with context:

${documentContext}

Current sheet data for context (match to these existing line items):
${existingSheetTable}

CRITICAL REQUIREMENTS:
1. Match Existing Structure: Only extract data for line items that already exist in the sheet.
2. Add New Periods: Focus on finding new time periods to add as columns.
3. Process ALL Documents: Analyze all provided parsed documents for additional periods.
4. Maintain Consistency: Use existing naming conventions and units.
5. Internal Verification: Verify accuracy across all periods.
6. Only include periods actually present in the documents.

Extract ONLY data for existing line items, adding new time periods as columns.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: {
        parts: [
          { text: prompt },
          ...fileParts
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: TABLE_RESPONSE_SCHEMA,
      }
    });

    if (!response.text) {
      throw new Error("The model returned an empty response. The stored documents might be unreadable or contain no financial tables.");
    }

    const MAX_JSON_LENGTH = 20000;
    let jsonText = response.text.trim();
    if (jsonText.length > MAX_JSON_LENGTH) {
      const lastBracket = jsonText.lastIndexOf(']');
      if (lastBracket !== -1) {
        jsonText = jsonText.slice(0, lastBracket + 1);
      }
      console.warn(`Gemini output was too long (${response.text.length} chars). Trimmed to ${jsonText.length} chars.`);
    }

    if (!jsonText) {
      throw new Error("The model returned an empty response after processing stored documents.");
    }

    let parsedData;
    try {
      parsedData = JSON.parse(jsonText);
    } catch (err) {
      throw new Error(`Gemini output was malformed. Please try again. (JSON length: ${jsonText.length})`);
    }

    console.log("Raw Gemini response from stored data:", jsonText);
    
    if (!Array.isArray(parsedData)) {
      throw new Error("The model did not return the data in the expected array format.");
    }

    // Validate extracted values
    const hasValues = parsedData.some(item => {
      const keys = Object.keys(item);
      return keys.length > 1 && keys.some(key => key !== 'lineItem' && item[key] && item[key].trim() !== '');
    });

    if (!hasValues) {
      console.warn("Warning: Gemini returned line items but no values from stored documents");
    } else {
      console.log("✅ Successfully extracted financial data from stored documents");
    }

    // Calculate processing statistics
    const processingTime = Date.now() - startTime;
    const lineItemsFound = parsedData.length;
    const periodSet = new Set<string>();
    parsedData.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'lineItem' && item[key] && item[key].trim() !== '') {
          periodSet.add(key);
        }
      });
    });
    const periodsFound = periodSet.size;

    // Update session status to completed
    storageService.updateStatus(sessionId, 'completed');

    return {
      data: parsedData,
      rawOutput: jsonText,
      stats: {
        filesProcessed: documents.length,
        lineItemsFound,
        periodsFound,
        processingTime
      }
    };

  } catch (error) {
    console.error("Error processing stored financial data with Gemini:", error);
    storageService.updateStatus(sessionId, 'error');
    
    if (error instanceof Error) {
      throw new Error(`Storage API Error: ${error.message}`);
    }
    throw new Error("An unexpected error occurred while processing stored documents.");
  }
};

/**
 * Processes financial data from LlamaParse JSON results
 * @param llamaParseResults Array of JSON results from LlamaParse
 * @param existingSheetData Current sheet data for context
 * @param operationType 'create' or 'update' mode
 * @returns Object with parsed data, raw output, and processing stats
 */
export const processLlamaParseResults = async (
  llamaParseResults: any[],
  existingSheetData: string[][],
  operationType: 'create' | 'update'
): Promise<{
  data: any[];
  rawOutput: string;
  stats: {
    filesProcessed: number;
    lineItemsFound: number;
    periodsFound: number;
    processingTime: number;
  };
}> => {
  const startTime = Date.now();
  
  if (!llamaParseResults || llamaParseResults.length === 0) {
    throw new Error('No LlamaParse results provided');
  }

  console.log(`🔧 Processing ${llamaParseResults.length} LlamaParse results in ${operationType.toUpperCase()} mode`);

  // Convert existing sheet to markdown table for context
  let existingSheetTable = '';
  if (existingSheetData && existingSheetData.length > 0) {
    const header = '| ' + existingSheetData[0].join(' | ') + ' |\n';
    const sep = '| ' + existingSheetData[0].map(() => '---').join(' | ') + ' |\n';
    const rows = existingSheetData.slice(1).map(row => '| ' + row.join(' | ') + ' |').join('\n');
    existingSheetTable = header + sep + rows;
    console.log("Existing sheet data for context:", existingSheetTable);
  }

  // Create context from LlamaParse results
  const documentContext = llamaParseResults.map((result, index) => 
    `Document ${index + 1}: ${result.fileName || 'Unknown'}\nJSON Content: ${JSON.stringify(result.jsonData).substring(0, 1000)}...`
  ).join('\n\n');

  // Create JSON content string for Gemini
  const jsonContent = llamaParseResults.map(result => 
    `File: ${result.fileName}\nParsed JSON:\n${JSON.stringify(result.jsonData, null, 2)}`
  ).join('\n\n---\n\n');

  let systemInstruction: string;
  let prompt: string;

  if (operationType === 'create') {
    systemInstruction = `You are an expert financial data extraction service. You receive JSON data from LlamaParse that has already parsed financial PDF documents. Your job is to analyze this structured JSON data and extract all financial line items with their corresponding values and time periods. Focus on accuracy and completeness.`;

    prompt = `CREATE MODE: Analyze the following JSON data from LlamaParse that contains parsed financial statements:

${jsonContent}

CRITICAL REQUIREMENTS:
1. Extract ALL financial line items and their values from the JSON data
2. Identify time periods (years, quarters) and their corresponding values
3. Create a comprehensive dataset with standardized line item names
4. Convert values to consistent units (preferably millions)
5. Arrange periods chronologically (earliest to latest)
6. Include data from income statements, balance sheets, and cash flow statements
7. Use minus signs for negative values, no parentheses
8. Only include periods that actually exist in the data

Extract ALL financial data you can find from the JSON, ensuring each line item has at least one period with a value.`;
  } else {
    systemInstruction = `You are an expert financial data extraction service for updating existing datasets. You receive JSON data from LlamaParse and existing sheet context. Focus on matching new data to existing line items and adding new time periods.`;

    prompt = `UPDATE MODE: Analyze the following JSON data from LlamaParse:

${jsonContent}

Existing sheet structure to match:
${existingSheetTable}

CRITICAL REQUIREMENTS:
1. ONLY extract data for line items that already exist in the current sheet
2. Focus on finding NEW time periods to add as columns
3. Match existing naming conventions and units exactly
4. Maintain consistency with existing data format
5. Add new periods chronologically
6. Only include periods that actually exist in the JSON data

Extract ONLY data for existing line items, adding new time periods as columns.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: TABLE_RESPONSE_SCHEMA,
      }
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty response when processing LlamaParse results.");
    }

    const MAX_JSON_LENGTH = 20000;
    let jsonText = response.text.trim();
    if (jsonText.length > MAX_JSON_LENGTH) {
      const lastBracket = jsonText.lastIndexOf(']');
      if (lastBracket !== -1) {
        jsonText = jsonText.slice(0, lastBracket + 1);
      }
      console.warn(`Gemini output was too long (${response.text.length} chars). Trimmed to ${jsonText.length} chars.`);
    }

    if (!jsonText) {
      throw new Error("Gemini returned an empty response after processing LlamaParse data.");
    }

    let parsedData;
    try {
      parsedData = JSON.parse(jsonText);
    } catch (err) {
      throw new Error(`Gemini output was malformed. Please try again. (JSON length: ${jsonText.length})`);
    }

    console.log("Raw Gemini response from LlamaParse data:", jsonText);
    
    if (!Array.isArray(parsedData)) {
      throw new Error("Gemini did not return the data in the expected array format.");
    }

    // Validate extracted values
    const hasValues = parsedData.some(item => {
      const keys = Object.keys(item);
      return keys.length > 1 && keys.some(key => key !== 'lineItem' && item[key] && item[key].trim() !== '');
    });

    if (!hasValues) {
      console.warn("Warning: Gemini returned line items but no values from LlamaParse data");
    } else {
      console.log("✅ Successfully extracted financial data from LlamaParse results");
    }

    // Calculate processing statistics
    const processingTime = Date.now() - startTime;
    const lineItemsFound = parsedData.length;
    const periodSet = new Set<string>();
    parsedData.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'lineItem' && item[key] && item[key].trim() !== '') {
          periodSet.add(key);
        }
      });
    });
    const periodsFound = periodSet.size;

    return {
      data: parsedData,
      rawOutput: jsonText,
      stats: {
        filesProcessed: llamaParseResults.length,
        lineItemsFound,
        periodsFound,
        processingTime
      }
    };

  } catch (error) {
    console.error("Error processing LlamaParse results with Gemini:", error);
    
    if (error instanceof Error) {
      throw new Error(`LlamaParse Processing Error: ${error.message}`);
    }
    throw new Error("An unexpected error occurred while processing LlamaParse data with Gemini.");
  }
};

/**
 * Legacy function - extracts financial data from multiple PDFs directly.
 * @deprecated Use extractFinancialDataFromStorage for new implementations
 * @param files Array of PDF files
 * @param existingSheet 2D array of existing sheet data
 * @param operationType Whether this is a 'create' (new sheet) or 'update' (existing sheet) operation
 * @returns Object with parsed data, raw output, and processing stats
 */
export const extractFinancialDataFromPdf = async (
  files: File[],
  existingSheet: string[][],
  operationType: 'create' | 'update' = 'create'
): Promise<{
  data: any[];
  rawOutput: string;
  stats: {
    filesProcessed: number;
    lineItemsFound: number;
    periodsFound: number;
    processingTime: number;
  };
}> => {
  const startTime = Date.now();
  // Convert all files to generative parts
  const pdfParts = await Promise.all(files.map(fileToGenerativePart));

  // Convert existing sheet to a markdown table for context
  let existingSheetTable = '';
  if (existingSheet && existingSheet.length > 0) {
    const header = '| ' + existingSheet[0].join(' | ') + ' |\n';
    const sep = '| ' + existingSheet[0].map(() => '---').join(' | ') + ' |\n';
    const rows = existingSheet.slice(1).map(row => '| ' + row.join(' | ') + ' |').join('\n');
    existingSheetTable = header + sep + rows;
    console.log("Existing sheet data for context:", existingSheetTable);
  } else {
    console.log("No existing sheet data found");
  }
  
  console.log(`🔧 Using ${operationType.toUpperCase()} mode for Gemini processing`);

  // Different prompts based on operation type
  let systemInstruction: string;
  let prompt: string;

  if (operationType === 'create') {
    systemInstruction = `You are an expert financial data extraction service for creating new financial datasets. Your task is to analyze financial documents and extract ALL numerical values associated with each line item for income statement, balance sheet and cash flow. You MUST include the actual financial values for each period. Your most important characteristics are to be accurate and complete. Take your time and be thorough.`;

    prompt = `CREATE MODE: Analyze the provided financial statement PDFs and extract ALL line items with their corresponding numerical values and periods from any financial tables (Income Statements, Balance Sheets, Cash Flow Statements).

CRITICAL REQUIREMENTS:
1. Process ALL Reports: Analyze all provided PDFs to build a comprehensive historical view of the company's financials.
2. Create Superset of Line Items: Scan all reports to create a standardized "superset" of all unique line items that have ever appeared. Normalize terminology (e.g., "Nettoomsättning" and "Net turnover" both become Net turnover).
3. Chronological Columns: Arrange the data with the earliest period first and the latest period last. Use years (e.g., 2022, 2023) or quarters (e.g., Q1 2023, Q2 2023) as column headers.
4. Standardize Numerical Values:
- Convert all monetary values to a single, consistent unit (e.g., Millions).
- Represent negative values with a leading minus sign (e.g., -123.4), not parentheses.
5. Internal Verification (MANDATORY): Before providing the output, you MUST internally verify the data for accuracy across every period:
- Balance Sheet: Confirm that Total Assets = Total Equity + Total Liabilities.
- Cash Flow: Confirm that the cash roll-forward is correct (Opening Cash + Cash Flow for Period +/- FX Differences = Closing Cash).
6. **For each line item, add a property for every period (year or quarter) you find in the PDFs. Do not invent or guess periods—only include periods that are actually present in the PDFs. The output should be a JSON array where each object has a 'lineItem' and one property for each period found.**

Example expected output format:
[
  {
    "lineItem": "Revenue",
    "2023": "1234567",
    "2022": "1000000",
    "Q1 2023": "300000"
  },
  {
    "lineItem": "Net Income",
    "2023": "123456",
    "2022": "50000",
    "Q1 2023": "5000"
  }
]

Extract ALL financial data you can find, ensuring each line item has at least one period with a value.`;
  } else {
    // UPDATE MODE
    systemInstruction = `You are an expert financial data extraction service for updating existing financial datasets. Your task is to analyze financial documents and extract ALL numerical values associated with each line item for income statement, balance sheet and cash flow. You MUST include the actual financial values for each period. Your most important characteristics are to be accurate and complete. Take your time and be thorough. First read the existing sheet to understand the current line items, then match new financial values to these existing line items.`;

    prompt = `UPDATE MODE: First, carefully read the existing sheet data to understand the current line items and their structure. Then analyze the provided financial statement PDFs and extract numerical values that match the existing line items.

CRITICAL REQUIREMENTS:
1. Read Existing Structure: First examine the existing sheet data to understand the current line items and their naming conventions.
2. Match to Existing Line Items: Only extract data for line items that already exist in the sheet. Do not create new line items.
3. Add New Columns: Focus on finding new time periods (years or quarters) to add as new columns to existing rows.
4. Process ALL Reports: Analyze all provided PDFs to find additional time periods for existing line items.
5. Chronological Columns: Arrange new periods chronologically with the earliest period first and the latest period last. Use years (e.g., 2022, 2023) or quarters (e.g., Q1 2023, Q2 2023) as column headers.
6. Standardize Numerical Values:
   - Convert all monetary values to a single, consistent unit (e.g., Millions).
   - Represent negative values with a leading minus sign (e.g., -123.4), not parentheses.
7. Internal Verification (MANDATORY): Before providing the output, you MUST internally verify the data for accuracy across every period:
   - Balance Sheet: Confirm that Total Assets = Total Equity + Total Liabilities.
   - Cash Flow: Confirm that the cash roll-forward is correct (Opening Cash + Cash Flow for Period +/- FX Differences = Closing Cash).
8. **For each line item, add a property for every period (year or quarter) you find in the PDFs. Do not invent or guess periods—only include periods that are actually present in the PDFs. The output should be a JSON array where each object has a 'lineItem' and one property for each period found.**

Example expected output format:
[
  {
    "lineItem": "Revenue",
    "2024": "1500000",
    "Q1 2024": "400000"
  },
  {
    "lineItem": "Net Income",
    "2024": "150000",
    "Q1 2024": "40000"
  }
]

Current sheet data for context (match to these existing line items):
${existingSheetTable}

Extract ONLY data for existing line items, adding new time periods as columns. Do not create new line items.`;
  }

  try {
    console.log(`Processing ${files.length} files with Gemini in ${operationType.toUpperCase()} mode...`);
    console.log(`Files:`, files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro", // Reverting to flash model which might be more reliable for this task
      contents: {
        parts: [
          { text: prompt },
          ...pdfParts
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: TABLE_RESPONSE_SCHEMA,
      }
    });

    if (!response.text) {
      throw new Error("The model returned an empty response. The document might be unreadable or contain no financial tables.");
    }
    const MAX_JSON_LENGTH = 20000;
    let jsonText = response.text.trim();
    if (jsonText.length > MAX_JSON_LENGTH) {
      // Try to salvage a valid JSON array by trimming to the last closing bracket
      const lastBracket = jsonText.lastIndexOf(']');
      if (lastBracket !== -1) {
        jsonText = jsonText.slice(0, lastBracket + 1);
      }
      // Warn the user
      console.warn(`Gemini output was too long (${response.text.length} chars). Trimmed to ${jsonText.length} chars.`);
    }
    if (!jsonText) {
      throw new Error("The model returned an empty response. The document might be unreadable or contain no financial tables.");
    }
    let parsedData;
    try {
      parsedData = JSON.parse(jsonText);
    } catch (err) {
      throw new Error(
        `Gemini output was too large or malformed. Please try with fewer periods or smaller PDFs. (JSON length: ${jsonText.length})`);
    }
    console.log("Raw Gemini response:", jsonText);
    
    if (!Array.isArray(parsedData)) {
      throw new Error("The model did not return the data in the expected array format.");
    }

    // Validate that we have actual values, not just line items
    const hasValues = parsedData.some(item => {
      const keys = Object.keys(item);
      return keys.length > 1 && keys.some(key => key !== 'lineItem' && item[key] && item[key].trim() !== '');
    });

    if (!hasValues) {
      console.warn("Warning: Gemini returned line items but no values. This might indicate:");
      console.warn("1. The PDFs don't contain extractable financial data");
      console.warn("2. The model needs more context or better prompting");
      console.warn("3. The PDFs might be image-based and need OCR");
      console.warn("4. The financial data might be in charts rather than tables");
      console.warn("Raw response for debugging:", jsonText);
    } else {
      console.log("✅ Successfully extracted financial data with values");
    }

    // Calculate processing statistics
    const processingTime = Date.now() - startTime;
    const lineItemsFound = parsedData.length;
    const periodSet = new Set<string>();
    parsedData.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'lineItem' && item[key] && item[key].trim() !== '') {
          periodSet.add(key);
        }
      });
    });
    const periodsFound = periodSet.size;

    return {
      data: parsedData,
      rawOutput: jsonText,
      stats: {
        filesProcessed: files.length,
        lineItemsFound,
        periodsFound,
        processingTime
      }
    };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
      throw new Error(`API Error: ${error.message}`);
    }
    throw new Error("An unexpected error occurred while communicating with the API.");
  }
};
