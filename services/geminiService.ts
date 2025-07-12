
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

// Enhanced schema with more specific guidance for value extraction
const TABLE_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      lineItem: { 
        type: Type.STRING, 
        description: "The name of the financial line item (e.g., 'Revenue', 'Net Income', 'Total Assets', 'Cash and Cash Equivalents')." 
      },
      // Example period properties to guide the model
      "2023": { 
        type: Type.STRING, 
        description: "The value for 2023 period (e.g., '$1,234,567', '($123,456)', '1,234,567')" 
      },
      "2022": { 
        type: Type.STRING, 
        description: "The value for 2022 period (e.g., '$1,000,000', '($100,000)', '1,000,000')" 
      },
      "Q1 2023": { 
        type: Type.STRING, 
        description: "The value for Q1 2023 period (e.g., '$300,000', '($25,000)', '300,000')" 
      },
      "Q2 2023": { 
        type: Type.STRING, 
        description: "The value for Q2 2023 period (e.g., '$350,000', '($30,000)', '350,000')" 
      }
    },
    required: ["lineItem"],
    additionalProperties: { 
      type: Type.STRING,
      description: "Additional period values (e.g., 'Q3 2023', 'Q4 2023', '2021', etc.) with their corresponding financial values"
    },
  },
};

/**
 * Extracts financial data from multiple PDFs, using README context and existing sheet data.
 * @param files Array of PDF files
 * @param readmeDocContent Context from README Google Doc
 * @param existingSheet 2D array of existing sheet data
 * @returns Object with parsed data, raw output, and processing stats
 */
export const extractFinancialDataFromPdf = async (
  files: File[],
  readmeDocContent: string,
  existingSheet: string[][]
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
  
  console.log("README content length:", readmeDocContent.length);
  if (readmeDocContent.length > 0) {
    console.log("README preview:", readmeDocContent.substring(0, 200) + "...");
  }

  const systemInstruction = `${readmeDocContent}\n\nYou are an expert financial data extraction service. Your task is to analyze financial documents and extract ALL numerical values associated with each line item. You MUST include the actual financial values (numbers, currency symbols, parentheses for negatives) for each period. Do not return empty or null values - if you cannot find a value for a period, omit that period entirely. Preserve exact formatting including currency symbols ($), commas, and parentheses for negative values.`;

  const prompt = `Analyze the provided financial statement PDFs and extract ALL line items with their corresponding numerical values and periods from any financial tables (Income Statements, Balance Sheets, Cash Flow Statements, etc.).

CRITICAL REQUIREMENTS:
1. Extract the ACTUAL numerical values for each line item and period
2. Preserve exact formatting (currency symbols, commas, parentheses for negatives)
3. If quarterly data is present, use period names like 'Q1 2023', 'Q2 2023', etc.
4. If annual data is present, use year names like '2023', '2022', etc.
5. Do NOT return empty or null values - only include periods where you find actual data
6. Look for tables, charts, and any structured financial data

Example expected output format:
[
  {
    "lineItem": "Revenue",
    "2023": "$1,234,567",
    "2022": "$1,000,000",
    "Q1 2023": "$300,000"
  },
  {
    "lineItem": "Net Income",
    "2023": "($123,456)",
    "2022": "$50,000",
    "Q1 2023": "($25,000)"
  }
]

Current sheet data for context (do not duplicate existing data):
${existingSheetTable}

Extract ALL financial data you can find, ensuring each line item has at least one period with a value.`;

  try {
    console.log(`Processing ${files.length} files with Gemini...`);
    console.log(`Files:`, files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Reverting to flash model which might be more reliable for this task
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
    const jsonText = response.text.trim();
    console.log("Raw Gemini response:", jsonText);
    
    if (!jsonText) {
      throw new Error("The model returned an empty response. The document might be unreadable or contain no financial tables.");
    }

    const parsedData = JSON.parse(jsonText);
    console.log("Parsed data:", parsedData);

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
