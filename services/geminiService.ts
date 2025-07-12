
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

// New schema: each object is a line item, with period columns (e.g., '2022', 'Q1 2023')
const TABLE_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      lineItem: { type: Type.STRING, description: "The name of the financial line item (e.g., 'Revenue', 'Net Income', 'Total Assets')." },
      // All other properties are dynamic period columns
    },
    required: ["lineItem"],
    additionalProperties: { type: Type.STRING },
  },
};

/**
 * Extracts financial data from multiple PDFs, using README context and existing sheet data.
 * @param files Array of PDF files
 * @param readmeDocContent Context from README Google Doc
 * @param existingSheet 2D array of existing sheet data
 * @returns Array of objects: { lineItem, period1: value, period2: value, ... }
 */
export const extractFinancialDataFromPdf = async (
  files: File[],
  readmeDocContent: string,
  existingSheet: string[][]
): Promise<any[]> => {
  // Convert all files to generative parts
  const pdfParts = await Promise.all(files.map(fileToGenerativePart));

  // Convert existing sheet to a markdown table for context
  let existingSheetTable = '';
  if (existingSheet && existingSheet.length > 0) {
    const header = '| ' + existingSheet[0].join(' | ') + ' |\n';
    const sep = '| ' + existingSheet[0].map(() => '---').join(' | ') + ' |\n';
    const rows = existingSheet.slice(1).map(row => '| ' + row.join(' | ') + ' |').join('\n');
    existingSheetTable = header + sep + rows;
  }

  const systemInstruction = `${readmeDocContent}\n\nYou are an automated financial data extraction service. Your only function is to analyze multiple financial documents and extract tabular data into a structured JSON table format. Each object in the array should have a 'lineItem' property and one property for each period (e.g., '2022', '2023', 'Q1 2023'). Do not add, omit, or interpret any information. Only add new data that is not already present in the provided sheet. Preserve all formatting (currency symbols, commas, parentheses for negatives).`;

  const prompt = `Please analyze the provided financial statement PDFs and extract all line items with their corresponding values and periods from any financial tables (like Income Statements, Balance Sheets, or Cash Flow Statements). Structure the output as a JSON array, where each object represents a line item and each property after 'lineItem' is a period (e.g., '2022', '2023', 'Q1 2023').\n\nIf quarterly data is present, use period names like 'Q1 2023', 'Q2 2023', etc.\n\nHere is the current sheet data for context (do not duplicate existing data):\n${existingSheetTable}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
    if (!jsonText) {
      throw new Error("The model returned an empty response. The document might be unreadable or contain no financial tables.");
    }

    const parsedData = JSON.parse(jsonText);

    if (!Array.isArray(parsedData)) {
      throw new Error("The model did not return the data in the expected array format.");
    }

    return parsedData;

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
      throw new Error(`API Error: ${error.message}`);
    }
    throw new Error("An unexpected error occurred while communicating with the API.");
  }
};
