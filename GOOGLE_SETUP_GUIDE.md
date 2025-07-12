# Google Cloud Console Setup Guide

This guide will help you set up all the necessary Google Cloud Console configurations for your PDF-to-Google Sheets project.

## Prerequisites
- A Google account
- Access to Google Cloud Console (https://console.cloud.google.com/)

## Step 1: Create a New Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top and select "New Project"
3. Enter a project name (e.g., "Stock Report Puncher")
4. Click "Create"

## Step 2: Enable Required APIs

In your new project, enable the following APIs:

### Google Drive API
1. Go to "APIs & Services" > "Library"
2. Search for "Google Drive API"
3. Click on it and press "Enable"

### Google Sheets API
1. In the same library, search for "Google Sheets API"
2. Click on it and press "Enable"

### Gemini API (for PDF processing)
1. Search for "Gemini API"
2. Click on it and press "Enable"

## Step 3: Create OAuth 2.0 Client ID

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. If prompted, configure the OAuth consent screen first:
   - User Type: External
   - App name: "Stock Report Puncher"
   - User support email: Your email
   - Developer contact information: Your email
   - Add scopes: `https://www.googleapis.com/auth/drive` and `https://www.googleapis.com/auth/spreadsheets`
   - Test users: Add your email address

4. Create the OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: "Stock Report Puncher Web Client"
   - Authorized JavaScript origins: 
     - For development: `http://localhost:5173` (Vite default)
     - For production: Your actual domain
   - Authorized redirect URIs: Leave empty for this setup

5. Copy the **Client ID** (you'll need this for `GOOGLE_CLIENT_ID`)

## Step 4: Create API Key

1. In "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy the generated API key
4. **Important**: Click on the API key to configure it:
   - Name: "Stock Report Puncher API Key"
   - Application restrictions: HTTP referrers (web sites)
   - Add your domain: `localhost:5173/*` (for development)
   - API restrictions: Restrict key to:
     - Google Drive API
     - Google Sheets API
     - Gemini API

## Step 5: Create Google Drive Folder

1. Go to [Google Drive](https://drive.google.com)
2. Create a new folder (e.g., "Stock Reports")
3. Open the folder and copy the folder ID from the URL:
   - URL format: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Copy the `FOLDER_ID_HERE` part

## Step 6: Update Your Configuration

Update your `config.ts` file with the real values:

```typescript
export const API_KEY = "your-actual-api-key-here";
export const GOOGLE_CLIENT_ID = "your-actual-client-id-here";
export const SHARED_GOOGLE_DRIVE_FOLDER_ID = "your-actual-folder-id-here";
```

## Step 7: Test Your Setup

1. Run your development server: `npm run dev`
2. Open the application in your browser
3. Try to sign in with Google
4. Test creating a stock folder and uploading data

## Troubleshooting

### Common Issues:

1. **"Access blocked" error**: Make sure your domain is added to authorized origins in OAuth client
2. **"API not enabled" error**: Ensure all required APIs are enabled in Google Cloud Console
3. **"Invalid API key" error**: Check that your API key is correct and has the right restrictions
4. **"OAuth consent screen" error**: Complete the OAuth consent screen setup

### Security Best Practices:

1. **Never commit real credentials** to version control
2. **Use environment variables** for production deployments
3. **Restrict API keys** to specific domains and APIs
4. **Regularly rotate** your API keys
5. **Monitor usage** in Google Cloud Console

## Environment Variables (Recommended for Production)

For production, consider using environment variables:

```typescript
export const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const SHARED_GOOGLE_DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
```

Create a `.env` file:
```
VITE_GOOGLE_API_KEY=your-api-key
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_DRIVE_FOLDER_ID=your-folder-id
```

Add `.env` to your `.gitignore` file to keep credentials secure. 