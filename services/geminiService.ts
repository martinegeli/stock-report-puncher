
import { GoogleGenAI, Type } from "@google/genai";
import { API_KEY } from '../config';
import type { FinancialDataItem } from '../types';

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
 * Extracts financial data from multiple PDFs, using existing sheet data for context.
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
