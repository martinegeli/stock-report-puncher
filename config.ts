// --- CONFIGURATION ---
// IMPORTANT: Replace the placeholder values below with your actual credentials.
// For production, it is crucial to secure your API_KEY. In the Google Cloud Console,
// restrict your API Key to your application's URL (HTTP referrer) to prevent unauthorized use.
// DO NOT commit this file with real credentials to a public git repository.

/**
 * Your Google API Key.
 * Used for both Gemini and Google Drive/Sheets APIs.
 * Get this from: https://console.cloud.google.com/apis/credentials
 * @example "AIzaSy...4U"
 */
export const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || "YOUR_GOOGLE_API_KEY_HERE";

/**
 * Your Google OAuth 2.0 Client ID.
 * This is used to authenticate users and is safe to be public.
 * Get this from: https://console.cloud.google.com/apis/credentials
 * @example "12345...abcdef.apps.googleusercontent.com"
 */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE";

/**
 * The unique ID of the folder in your Google Drive where all stock-related
 * folders will be created.
 * To get this ID:
 * 1. Create a folder in Google Drive
 * 2. Open the folder and copy the ID from the URL: https://drive.google.com/drive/folders/FOLDER_ID_HERE
 * @example "1AbC...XyZ"
 */
export const SHARED_GOOGLE_DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || "YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE";

/**
 * Your LlamaParse API Key.
 * Used for parsing PDF documents into structured JSON.
 * Get this from: https://cloud.llamaindex.ai/
 * @example "llx-..."
 */
export const LLAMAPARSE_API_KEY = import.meta.env.VITE_LLAMAPARSE_API_KEY || "YOUR_LLAMAPARSE_API_KEY_HERE";

/**
 * Maximum number of PDFs to process in a batch with LlamaParse.
 * Default: 10 (recommended limit)
 */
export const LLAMAPARSE_BATCH_SIZE = parseInt(import.meta.env.VITE_LLAMAPARSE_BATCH_SIZE || "10", 10);

/**
 * Processing timeout in milliseconds.
 * Default: 5 minutes (300000ms)
 */
export const PROCESSING_TIMEOUT = parseInt(import.meta.env.VITE_PROCESSING_TIMEOUT || "300000", 10);

// Validation function to check if credentials are properly set
export const validateConfig = () => {
    const missing = [];
    if (!API_KEY || API_KEY === "YOUR_GOOGLE_API_KEY_HERE") {
        missing.push("API_KEY");
    }
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID_HERE") {
        missing.push("GOOGLE_CLIENT_ID");
    }
    if (!SHARED_GOOGLE_DRIVE_FOLDER_ID || SHARED_GOOGLE_DRIVE_FOLDER_ID === "YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE") {
        missing.push("SHARED_GOOGLE_DRIVE_FOLDER_ID");
    }
    if (!LLAMAPARSE_API_KEY || LLAMAPARSE_API_KEY === "YOUR_LLAMAPARSE_API_KEY_HERE") {
        missing.push("LLAMAPARSE_API_KEY");
    }
    
    if (missing.length > 0) {
        throw new Error(`Missing or placeholder credentials: ${missing.join(", ")}. Please update your .env file with actual API credentials.`);
    }
};
