
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
