
import { GoogleGenAI, Type } from "@google/genai";
import { API_KEY } from '../config';

// The API_KEY is sourced from the config.ts file.
const ai = new GoogleGenAI({ apiKey: API_KEY });


// Table format schema: return data as 2D array ready for Google Sheets
const TABLE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headers: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Column headers starting with 'Line Item' followed by time periods in chronological order (e.g., ['Line Item', '2022', '2023', 'Q1 2024'])"
    },
    rows: {
      type: Type.ARRAY,
      items: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Each row contains the line item name followed by its values for each time period (e.g., ['Revenue', '1234.5', '1567.8', '456.2'])"
      },
      description: "Array of rows where each row is an array of strings. First element is the line item name, followed by numerical values for each time period in the same order as headers."
    }
  },
  required: ["headers", "rows"]
};


/**
 * Processes a single LlamaParse result with Gemini
 * @param singleResult Single LlamaParse result
 * @param existingSheetData Current sheet data for context
 * @param operationType 'create' or 'update' mode
 * @returns Processed data from single document
 */
const processSingleLlamaParseResult = async (
  singleResult: any,
  existingSheetData: string[][],
  operationType: 'create' | 'update'
): Promise<any[]> => {
  // Extract content from single result
  let content = '';
  if (singleResult.jsonData?.markdown) {
    content = singleResult.jsonData.markdown;
  } else {
    content = JSON.stringify(singleResult.jsonData, null, 2) || '';
  }

  const fileName = singleResult.fileName || 'Unknown';
  console.log(`📄 Processing single document: ${fileName} (${content.length} chars)`);

  // Create prompts for single document
  let systemInstruction: string;
  let prompt: string;

  if (operationType === 'create') {
    systemInstruction = `You are a comprehensive financial data extraction expert. Extract ALL financial data from this single document, including primary statements AND notes sections.`;
    
    prompt = `CREATE MODE: Extract ALL financial data from this single document.

DOCUMENT: ${fileName}
CONTENT:
${content.substring(0, 50000)}

Extract comprehensive financial data including Notes sections. Return ALL available line items with their values.`;
  } else {
    // UPDATE mode with existing sheet context
    const existingSheetTable = existingSheetData.length > 0 
      ? '| ' + existingSheetData[0].join(' | ') + ' |\n' +
        '| ' + existingSheetData[0].map(() => '---').join(' | ') + ' |\n' +
        existingSheetData.slice(1).map(row => '| ' + row.join(' | ') + ' |').join('\n')
      : '';

    systemInstruction = `You are a financial data extraction expert. Match data from this single document to existing line items and extract new time periods.`;
    
    prompt = `UPDATE MODE: Extract data from this single document and match to existing structure.

DOCUMENT: ${fileName}
CONTENT:
${content.substring(0, 40000)}

EXISTING SHEET:
${existingSheetTable}

Match line items and extract new time periods with values.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
      console.error(`❌ No response for ${fileName}`);
      return [];
    }

    const parsed = JSON.parse(response.text.trim());
    if (parsed.headers && parsed.rows) {
      return parsed.rows.map((row: string[]) => {
        const item: any = { lineItem: row[0] };
        parsed.headers.slice(1).forEach((header: string, index: number) => {
          item[header] = row[index + 1] || '';
        });
        return item;
      });
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`❌ Error processing ${fileName}:`, error);
    return [];
  }
};

/**
 * Processes a small batch of documents together for CREATE mode
 */
const processSingleBatchForCreate = async (
  llamaParseResults: any[]
): Promise<{ data: any[], rawOutput: string }> => {
  const extractedContent = llamaParseResults.map(result => {
    let content = '';
    if (result.jsonData?.markdown) {
      content = result.jsonData.markdown;
    } else {
      content = JSON.stringify(result.jsonData, null, 2) || '';
    }
    return {
      fileName: result.fileName || 'Unknown',
      content: content.substring(0, 40000)
    };
  });

  const systemInstruction = `You are a comprehensive financial data extraction expert. Extract ALL financial data from these documents, including primary statements AND notes sections.`;
  
  const prompt = `CREATE MODE: Extract ALL financial data from these documents.

${extractedContent.map(doc => `=== ${doc.fileName} ===\n${doc.content}`).join('\n\n')}

Extract comprehensive financial data including Notes sections with 50+ line items minimum.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: TABLE_RESPONSE_SCHEMA,
      }
    });

    if (!response.text) return { data: [], rawOutput: '' };

    const parsed = JSON.parse(response.text.trim());
    if (parsed.headers && parsed.rows) {
      const data = parsed.rows.map((row: string[]) => {
        const item: any = { lineItem: row[0] };
        parsed.headers.slice(1).forEach((header: string, index: number) => {
          item[header] = row[index + 1] || '';
        });
        return item;
      });
      return { data, rawOutput: response.text };
    }
    return { data: Array.isArray(parsed) ? parsed : [], rawOutput: response.text };
  } catch (error) {
    console.error('❌ Error in batch CREATE processing:', error);
    return { data: [], rawOutput: '' };
  }
};

/**
 * SINGLE POINT OF TRUTH: Processes financial data from LlamaParse results
 * Handles both CREATE and UPDATE modes with one-at-a-time processing for large batches
 * @param llamaParseResults Array of JSON results from LlamaParse with extracted content
 * @param existingSheetData Current sheet data for context (empty array for CREATE mode)
 * @param operationType 'create' or 'update' mode
 * @returns Object with parsed data, raw output, and processing stats
 */
export const processLlamaParseResults = async (
  llamaParseResults: any[],
  existingSheetData: string[][] = [],
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

  console.log(`🔧 Processing ${llamaParseResults.length} documents one-at-a-time in ${operationType.toUpperCase()} mode`);

  // Validation for UPDATE mode
  if (operationType === 'update' && (!existingSheetData || existingSheetData.length === 0)) {
    throw new Error('UPDATE mode requires existing sheet data, but none was provided');
  }

  // Process documents one at a time for better handling of large batches
  let allData: any[] = [];
  let combinedRawOutput = '';
  
  if (operationType === 'create') {
    // CREATE mode: Use single file only to establish structure correctly
    if (llamaParseResults.length > 1) {
      console.log(`⚠️ CREATE mode: ${llamaParseResults.length} files provided, using only the FIRST file to establish structure`);
      console.log(`📄 Recommended: Use only 1 comprehensive file for CREATE mode to set proper line item structure`);
    }
    
    // Process only the first file for CREATE mode
    const firstFile = llamaParseResults[0];
    console.log(`📄 CREATE mode: Processing single file to establish structure: ${firstFile.fileName}`);
    const singleData = await processSingleLlamaParseResult(firstFile, existingSheetData, operationType);
    allData = singleData;
    combinedRawOutput = `CREATE mode - Structure established from: ${firstFile.fileName}`;
    
    if (llamaParseResults.length > 1) {
      console.log(`📝 Note: ${llamaParseResults.length - 1} additional files were ignored in CREATE mode. Use UPDATE mode to add data from remaining files.`);
    }
  } else {
    // For UPDATE mode, always process one-at-a-time
    console.log(`📄 UPDATE mode: Processing ${llamaParseResults.length} documents one-at-a-time`);
    for (let i = 0; i < llamaParseResults.length; i++) {
      console.log(`Processing document ${i + 1}/${llamaParseResults.length}: ${llamaParseResults[i].fileName}`);
      const singleData = await processSingleLlamaParseResult(llamaParseResults[i], existingSheetData, operationType);
      
      // Merge data intelligently for UPDATE mode
      for (const newItem of singleData) {
        const existingIndex = allData.findIndex(item => item.lineItem === newItem.lineItem);
        if (existingIndex >= 0) {
          // Merge periods for existing line item
          Object.assign(allData[existingIndex], newItem);
        } else {
          // Add new line item
          allData.push(newItem);
        }
      }
      combinedRawOutput += `Document ${i + 1}: ${llamaParseResults[i].fileName}\n`;
    }
  }

  // Calculate statistics for the processed data
  const processingTime = Date.now() - startTime;
  const lineItemsFound = allData.length;
  const periodSet = new Set<string>();
  allData.forEach((item: any) => {
    Object.keys(item).forEach(key => {
      if (key !== 'lineItem' && item[key] && item[key].trim() !== '') {
        periodSet.add(key);
      }
    });
  });
  const periodsFound = periodSet.size;

  // Validate extracted data
  const hasValues = allData.some((item: any) => {
    const keys = Object.keys(item);
    return keys.length > 1 && keys.some(key => key !== 'lineItem' && item[key] && item[key].trim() !== '');
  });

  if (!hasValues) {
    console.warn(`⚠️ ${operationType.toUpperCase()} mode: No values extracted from documents`);
  } else {
    console.log(`✅ ${operationType.toUpperCase()} mode: Successfully extracted comprehensive financial data`);
  }

  console.log(`📊 Final ${operationType.toUpperCase()} stats: ${lineItemsFound} line items, ${periodsFound} periods, ${processingTime}ms`);

  return {
    data: allData,
    rawOutput: combinedRawOutput,
    stats: {
      filesProcessed: llamaParseResults.length,
      lineItemsFound,
      periodsFound,
      processingTime
    }
  };
};

