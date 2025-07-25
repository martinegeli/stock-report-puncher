
import { API_KEY, GOOGLE_CLIENT_ID, SHARED_GOOGLE_DRIVE_FOLDER_ID, validateConfig } from '../config';
import type { FinancialDataItem, StockFolder } from '../types';

// Declare gapi and google objects from the loaded scripts
declare global {
    var gapi: any;
    var google: any;
}

const DISCOVERY_DOC_DRIVE = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const DISCOVERY_DOC_SHEETS = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const DISCOVERY_DOC_DOCS = 'https://docs.googleapis.com/$discovery/rest?version=v1';
const SCOPES = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/documents.readonly';

let tokenClient: any;
let onAuthChangeCallback: (isSignedIn: boolean) => void;

// --- CREDENTIALS VALIDATION ---
const validateCredentials = () => {
    validateConfig();
}

/**
 * Parses a Google API client error to extract a meaningful message.
 * @param error The error object thrown by the gapi client.
 * @returns A string with the detailed error message.
 */
const parseGoogleApiError = (error: any): string => {
    if (error?.result?.error?.message) {
        return error.result.error.message;
    }
    if (error?.details) {
        return error.details;
    }
    if (error instanceof Error) {
        return error.message;
    }
    try {
        const body = JSON.parse(error.body);
        return body?.error?.message || 'An unknown error occurred.';
    } catch {
        return 'An unknown error occurred. Check the browser console for details.';
    }
};


// --- INITIALIZATION ---
export const initGoogleClient = (onStatusChange: (isSignedIn: boolean) => void): Promise<void> => {
    onAuthChangeCallback = onStatusChange;
    return new Promise((resolve, reject) => {
        try {
            validateCredentials();

            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: API_KEY,
                        discoveryDocs: [DISCOVERY_DOC_DRIVE, DISCOVERY_DOC_SHEETS, DISCOVERY_DOC_DOCS],
                    });
                    
                    tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: GOOGLE_CLIENT_ID,
                        scope: SCOPES,
                        callback: (tokenResponse: any) => {
                            if (tokenResponse && tokenResponse.access_token) {
                                onAuthChangeCallback(true);
                            } else {
                                console.log('User cancelled sign-in or failed to get token.');
                                onAuthChangeCallback(false);
                            }
                        },
                        error_callback: (error: any) => {
                           console.error('GSI Error:', error);
                           reject(new Error(`Google Sign-In failed: ${parseGoogleApiError(error)}`));
                        }
                    });
                    
                    onAuthChangeCallback(false);
                    resolve();

                } catch (err: unknown) {
                    const errorMessage = `Could not initialize Google client. ${parseGoogleApiError(err)}`;
                    reject(new Error(errorMessage));
                }
            });
        } catch (err) {
            reject(err);
        }
    });
};

// --- AUTHENTICATION ---
export const handleSignIn = () => {
  if (!tokenClient) {
    throw new Error("Google API client is not initialized.");
  }
  tokenClient.requestAccessToken({prompt: 'consent'});
};

// --- GOOGLE DRIVE & SHEETS OPERATIONS ---

export const listStockFolders = async (): Promise<StockFolder[]> => {
  try {
    const response = await gapi.client.drive.files.list({
      q: `'${SHARED_GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 100
    });
    
    const folders = response.result.files || [];
    
    const stockFolders: StockFolder[] = await Promise.all(folders.map(async (folder: any) => {
      const sheetResponse = await gapi.client.drive.files.list({
        q: `'${folder.id}' in parents and name='Financials' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
        fields: 'files(id, webViewLink)'
      });

      const sheet = sheetResponse.result.files?.[0];
      return {
        id: folder.id,
        name: folder.name,
        sheetId: sheet?.id,
        sheetUrl: sheet?.webViewLink
      };
    }));

    return stockFolders.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error listing stock folders:", error);
    const detailedError = parseGoogleApiError(error);
    throw new Error(`Could not list stock folders. Google Drive API Error: ${detailedError}`);
  }
};


export const createStockFolder = async (ticker: string): Promise<StockFolder> => {
  const upperCaseTicker = ticker.toUpperCase();
  try {
    const checkResponse = await gapi.client.drive.files.list({
        q: `name='${upperCaseTicker}' and '${SHARED_GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)'
    });

    if (checkResponse.result.files && checkResponse.result.files.length > 0) {
        throw new Error(`A folder for "${upperCaseTicker}" already exists in Google Drive.`);
    }

    const folderMetadata = {
      name: upperCaseTicker,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [SHARED_GOOGLE_DRIVE_FOLDER_ID]
    };
    const folderResponse = await gapi.client.drive.files.create({
      resource: folderMetadata,
      fields: 'id'
    });
    const newFolderId = folderResponse.result.id;

    const sheetMetadata = {
      properties: { title: 'Financials' },
      sheets: [{ properties: { title: 'Data' } }]
    };
    const sheetResponse = await gapi.client.sheets.spreadsheets.create({
      resource: sheetMetadata,
      fields: 'spreadsheetId,spreadsheetUrl'
    });

    const newSheetId = sheetResponse.result.spreadsheetId;
    const newSheetUrl = sheetResponse.result.spreadsheetUrl;
    
    const file = await gapi.client.drive.files.get({
      fileId: newSheetId,
      fields: 'parents'
    });
    const previousParents = file.result.parents.join(',');
    
    await gapi.client.drive.files.update({
      fileId: newSheetId,
      addParents: newFolderId,
      removeParents: previousParents,
      fields: 'id, parents'
    });

    // Set a placeholder header row: just ['lineItem']
    const headerRow = [['lineItem']];
    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: newSheetId,
        range: 'Data!A1',
        valueInputOption: 'USER_ENTERED',
        resource: { values: headerRow }
    });

    return {
      id: newFolderId,
      name: upperCaseTicker,
      sheetId: newSheetId,
      sheetUrl: newSheetUrl
    };
  } catch(error) {
      console.error(`Error creating stock folder for "${ticker}":`, error);
      if (error instanceof Error && error.message.includes('already exists')) {
          throw error;
      }
      const detailedError = parseGoogleApiError(error);
      throw new Error(`Failed to create folder. Google API Error: ${detailedError}`);
  }
};

/**
 * Finds or creates a stock folder and sheet in the OUTPUT directory
 * @param stockName The name of the stock (matches INPUT folder name)
 * @returns StockFolder object with folder and sheet details
 */
export const findOrCreateOutputStockFolder = async (stockName: string): Promise<StockFolder> => {
  const upperCaseStockName = stockName.toUpperCase();
  
  try {
    // First, find the OUTPUT folder
    const outputFolderQuery = await gapi.client.drive.files.list({
      q: `name='OUTPUT' and '${SHARED_GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)'
    });

    if (!outputFolderQuery.result.files || outputFolderQuery.result.files.length === 0) {
      throw new Error('OUTPUT folder not found in Google Drive');
    }

    const outputFolderId = outputFolderQuery.result.files[0].id;
    console.log(`Found OUTPUT folder: ${outputFolderId}`);

    // Check if stock folder already exists in OUTPUT
    const stockFolderQuery = await gapi.client.drive.files.list({
      q: `name='${upperCaseStockName}' and '${outputFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)'
    });

    let stockFolderId: string;

    if (stockFolderQuery.result.files && stockFolderQuery.result.files.length > 0) {
      // Stock folder exists
      stockFolderId = stockFolderQuery.result.files[0].id;
      console.log(`Found existing stock folder in OUTPUT: ${stockFolderId}`);
    } else {
      // Create stock folder in OUTPUT
      const stockFolderMetadata = {
        name: upperCaseStockName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [outputFolderId]
      };
      const stockFolderResponse = await gapi.client.drive.files.create({
        resource: stockFolderMetadata,
        fields: 'id'
      });
      stockFolderId = stockFolderResponse.result.id;
      console.log(`Created new stock folder in OUTPUT: ${stockFolderId}`);
    }

    // Check if Financials sheet already exists in the stock folder
    const sheetsQuery = await gapi.client.drive.files.list({
      q: `name='Financials' and '${stockFolderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      fields: 'files(id, name, webViewLink)'
    });

    let sheetId: string;
    let sheetUrl: string;

    if (sheetsQuery.result.files && sheetsQuery.result.files.length > 0) {
      // Sheet exists
      sheetId = sheetsQuery.result.files[0].id;
      sheetUrl = sheetsQuery.result.files[0].webViewLink;
      console.log(`Found existing Financials sheet: ${sheetId}`);
    } else {
      // Create new Financials sheet
      const sheetMetadata = {
        properties: { title: 'Financials' },
        sheets: [{ properties: { title: 'Data' } }]
      };
      const sheetResponse = await gapi.client.sheets.spreadsheets.create({
        resource: sheetMetadata,
        fields: 'spreadsheetId,spreadsheetUrl'
      });

      sheetId = sheetResponse.result.spreadsheetId;
      sheetUrl = sheetResponse.result.spreadsheetUrl;

      // Move sheet to the stock folder
      const file = await gapi.client.drive.files.get({
        fileId: sheetId,
        fields: 'parents'
      });
      const previousParents = file.result.parents.join(',');

      await gapi.client.drive.files.update({
        fileId: sheetId,
        addParents: stockFolderId,
        removeParents: previousParents,
        fields: 'id, parents'
      });

      // Set initial header row
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Data!A1',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [['lineItem']] }
      });

      console.log(`Created new Financials sheet in OUTPUT/${upperCaseStockName}: ${sheetId}`);
    }

    return {
      id: stockFolderId,
      name: upperCaseStockName,
      sheetId: sheetId,
      sheetUrl: sheetUrl
    };

  } catch (error) {
    console.error(`Error finding/creating OUTPUT stock folder for "${stockName}":`, error);
    const detailedError = parseGoogleApiError(error);
    throw new Error(`Failed to find/create OUTPUT folder for ${stockName}. Google API Error: ${detailedError}`);
  }
};

/**
 * Appends rows (2D array of strings) to the Data sheet of a Google Sheet.
 */
export const appendToSheet = async (rows: string[][], sheetId: string): Promise<void> => {
  if (!sheetId) {
    throw new Error("Cannot append data: Sheet ID is missing.");
  }
  try {
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Data',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: rows },
    });
  } catch (error) {
    console.error("Error appending to sheet:", error);
    const detailedError = parseGoogleApiError(error);
    throw new Error(`Failed to append data to the Google Sheet. Google API Error: ${detailedError}`);
  }
};

/**
 * Updates specific cells in the Data sheet of a Google Sheet.
 * Used for adding new columns to existing rows.
 */
export const updateSheetCells = async (updates: { range: string; values: string[][] }[], sheetId: string): Promise<void> => {
  if (!sheetId) {
    throw new Error("Cannot update data: Sheet ID is missing.");
  }
  try {
    const batchUpdateRequest = {
      valueInputOption: 'USER_ENTERED',
      data: updates.map(update => ({
        range: `Data!${update.range}`,
        values: update.values
      }))
    };

    await gapi.client.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      resource: batchUpdateRequest
    });
  } catch (error) {
    console.error("Error updating sheet cells:", error);
    const detailedError = parseGoogleApiError(error);
    throw new Error(`Failed to update data in the Google Sheet. Google API Error: ${detailedError}`);
  }
};

/**
 * Reads all data from the 'Data' sheet of a Google Sheet by ID.
 * Returns a 2D array of strings (rows and columns), or an empty array if not found.
 */
export const getSheetData = async (sheetId: string): Promise<string[][]> => {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Data',
    });
    return response.result.values || [];
  } catch (err) {
    console.error('Failed to fetch sheet data:', err);
    return [];
  }
};

// --- GOOGLE DOCS: README FETCH ---
/**
 * Finds and reads the content of a Google Doc named "README" in the main shared folder.
 * Returns the plain text content, or an empty string if not found.
 */
export const getReadmeDocContent = async (): Promise<string> => {
  try {
    // 1. Find the README Google Doc in the main folder
    const driveRes = await gapi.client.drive.files.list({
      q: `name='README' and '${SHARED_GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 1
    });
    const readmeFile = driveRes.result.files?.[0];
    if (!readmeFile) {
      return '';
    }
    // 2. Fetch the document content from Google Docs API
    const docRes = await gapi.client.docs.documents.get({
      documentId: readmeFile.id
    });
    // 3. Extract plain text from the document body
    const body = docRes.result.body;
    if (!body || !body.content) return '';
    let text = '';
    for (const element of body.content) {
      if (element.paragraph && element.paragraph.elements) {
        for (const el of element.paragraph.elements) {
          if (el.textRun && el.textRun.content) {
            text += el.textRun.content;
          }
        }
      }
    }
    return text.trim();
  } catch (err) {
    console.error('Failed to fetch README Google Doc:', err);
    return '';
  }
};

// --- GOOGLE DRIVE: INPUT/OUTPUT FOLDER OPERATIONS ---

/**
 * Lists all PDF files in the INPUT/{stockName} folder
 */
export const listInputPdfs = async (stockName: string): Promise<{id: string, name: string}[]> => {
  try {
    // First find the INPUT folder
    const inputFolderResponse = await gapi.client.drive.files.list({
      q: `name='INPUT' and '${SHARED_GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
      pageSize: 1
    });
    
    const inputFolder = inputFolderResponse.result.files?.[0];
    if (!inputFolder) {
      throw new Error('INPUT folder not found in Google Drive');
    }

    // Find the stock-specific folder within INPUT
    const stockFolderResponse = await gapi.client.drive.files.list({
      q: `name='${stockName}' and '${inputFolder.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
      pageSize: 1
    });

    const stockFolder = stockFolderResponse.result.files?.[0];
    if (!stockFolder) {
      throw new Error(`INPUT/${stockName} folder not found in Google Drive`);
    }

    // List all PDF files in the stock folder
    const pdfResponse = await gapi.client.drive.files.list({
      q: `'${stockFolder.id}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 100
    });

    return pdfResponse.result.files || [];
  } catch (error) {
    console.error(`Error listing INPUT PDFs for ${stockName}:`, error);
    const detailedError = parseGoogleApiError(error);
    throw new Error(`Could not list PDF files from INPUT/${stockName}. ${detailedError}`);
  }
};

/**
 * Lists all files in OUTPUT folders to show existing processed data
 */
export const listOutputFolders = async (): Promise<{stockName: string, files: {id: string, name: string}[]}[]> => {
  try {
    // First find the OUTPUT folder
    const outputFolderResponse = await gapi.client.drive.files.list({
      q: `name='OUTPUT' and '${SHARED_GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
      pageSize: 1
    });
    
    const outputFolder = outputFolderResponse.result.files?.[0];
    if (!outputFolder) {
      return []; // No OUTPUT folder exists yet
    }

    // List all stock folders within OUTPUT
    const stockFoldersResponse = await gapi.client.drive.files.list({
      q: `'${outputFolder.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 100
    });

    const stockFolders = stockFoldersResponse.result.files || [];
    
    // For each stock folder, list its files
    const result = await Promise.all(stockFolders.map(async (folder: any) => {
      const filesResponse = await gapi.client.drive.files.list({
        q: `'${folder.id}' in parents and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 100
      });

      return {
        stockName: folder.name,
        files: filesResponse.result.files || []
      };
    }));

    return result.sort((a, b) => a.stockName.localeCompare(b.stockName));
  } catch (error) {
    console.error('Error listing OUTPUT folders:', error);
    const detailedError = parseGoogleApiError(error);
    throw new Error(`Could not list OUTPUT folders. ${detailedError}`);
  }
};

/**
 * Lists all folders in INPUT to show which stocks have PDFs available for processing
 */
export const listInputFolders = async (): Promise<{stockName: string, files: {id: string, name: string}[]}[]> => {
  try {
    // First find the INPUT folder
    const inputFolderResponse = await gapi.client.drive.files.list({
      q: `name='INPUT' and '${SHARED_GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
      pageSize: 1
    });
    
    const inputFolder = inputFolderResponse.result.files?.[0];
    if (!inputFolder) {
      return []; // No INPUT folder exists yet
    }

    // List all stock folders within INPUT
    const stockFoldersResponse = await gapi.client.drive.files.list({
      q: `'${inputFolder.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 100
    });

    const stockFolders = stockFoldersResponse.result.files || [];
    
    // For each stock folder, list its PDF files
    const result = await Promise.all(stockFolders.map(async (folder: any) => {
      const filesResponse = await gapi.client.drive.files.list({
        q: `'${folder.id}' in parents and mimeType='application/pdf' and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 100
      });

      return {
        stockName: folder.name,
        files: filesResponse.result.files || []
      };
    }));

    // Only return folders that have PDF files
    return result.filter(folder => folder.files.length > 0).sort((a, b) => a.stockName.localeCompare(b.stockName));
  } catch (error) {
    console.error('Error listing INPUT folders:', error);
    const detailedError = parseGoogleApiError(error);
    throw new Error(`Could not list INPUT folders. ${detailedError}`);
  }
};

/**
 * Check if a stock has existing OUTPUT files
 */
export const checkExistingOutputFiles = async (stockName: string): Promise<{id: string, name: string}[]> => {
  try {
    // First find the OUTPUT folder
    const outputFolderResponse = await gapi.client.drive.files.list({
      q: `name='OUTPUT' and '${SHARED_GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
      pageSize: 1
    });
    
    const outputFolder = outputFolderResponse.result.files?.[0];
    if (!outputFolder) {
      return []; // No OUTPUT folder exists yet
    }

    // Find the stock-specific folder within OUTPUT
    const stockFolderResponse = await gapi.client.drive.files.list({
      q: `name='${stockName}' and '${outputFolder.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
      pageSize: 1
    });

    const stockFolder = stockFolderResponse.result.files?.[0];
    if (!stockFolder) {
      return []; // No stock folder in OUTPUT
    }

    // List all files in the stock's OUTPUT folder
    const filesResponse = await gapi.client.drive.files.list({
      q: `'${stockFolder.id}' in parents and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 100
    });

    return filesResponse.result.files || [];
  } catch (error) {
    console.error(`Error checking existing OUTPUT files for ${stockName}:`, error);
    return []; // Return empty array on error rather than throwing
  }
};

/**
 * Downloads a PDF file from Google Drive and converts it to a File object
 */
export const downloadPdfFromDrive = async (fileId: string, fileName: string): Promise<File> => {
  try {
    console.log(`Downloading PDF ${fileName} (ID: ${fileId}) from Google Drive...`);
    
    // Use the simpler gapi.client.drive.files.get method
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media'
    });

    console.log('Google Drive API response:', {
      status: response.status,
      headers: Object.keys(response.headers || {}),
      bodyType: typeof response.body,
      bodyConstructor: response.body?.constructor?.name,
      bodyLength: response.body?.length || response.body?.byteLength || 'unknown'
    });

    if (!response.body) {
      throw new Error('No data received from Google Drive API');
    }

    // Handle different possible response body formats
    let blob;
    
    if (response.body instanceof Blob) {
      // Already a blob
      blob = response.body;
    } else if (response.body instanceof ArrayBuffer) {
      // ArrayBuffer - convert to blob
      blob = new Blob([response.body], { type: 'application/pdf' });
    } else if (typeof response.body === 'string') {
      // String - could be base64 or binary string
      try {
        // First, try to decode as base64
        const binaryString = atob(response.body);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: 'application/pdf' });
      } catch {
        // If base64 fails, treat as binary string
        const bytes = new Uint8Array(response.body.length);
        for (let i = 0; i < response.body.length; i++) {
          bytes[i] = response.body.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: 'application/pdf' });
      }
    } else {
      // Unknown format - try to convert to string first
      const bodyStr = String(response.body);
      const bytes = new Uint8Array(bodyStr.length);
      for (let i = 0; i < bodyStr.length; i++) {
        bytes[i] = bodyStr.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: 'application/pdf' });
    }

    console.log(`Created blob: ${blob.size} bytes, type: ${blob.type}`);

    if (blob.size === 0) {
      throw new Error('Downloaded file is empty');
    }

    // Create a File object from the blob
    const file = new File([blob], fileName, { 
      type: 'application/pdf',
      lastModified: Date.now()
    });
    
    console.log(`Created File object: ${file.name}, size: ${file.size}, type: ${file.type}`);
    
    // Validate that we have a valid PDF by checking the first few bytes
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const pdfSignature = uint8Array.slice(0, 4);
    const isPdf = pdfSignature[0] === 0x25 && pdfSignature[1] === 0x50 && 
                  pdfSignature[2] === 0x44 && pdfSignature[3] === 0x46; // %PDF
    
    if (!isPdf) {
      console.warn('Downloaded file does not appear to be a valid PDF');
      console.log('First 10 bytes:', Array.from(uint8Array.slice(0, 10)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
    }
    
    return file;
  } catch (error) {
    console.error(`Error downloading PDF ${fileName}:`, error);
    const detailedError = parseGoogleApiError(error);
    throw new Error(`Could not download PDF file. ${detailedError}`);
  }
};
