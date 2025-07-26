# LlamaParse Integration Setup

## Overview
Your application now uses **LlamaParse** for PDF processing followed by **Gemini** for financial data extraction. This provides more accurate parsing of complex financial documents.

## New Workflow
1. **File Selection** - Choose PDFs from INPUT/{stock-name} folders
2. **LlamaParse Processing** - PDFs are converted to structured JSON (batch up to 10 files)
3. **Gemini Analysis** - JSON data is processed to extract financial information
4. **Google Sheets Update** - Data is saved to your spreadsheets
5. **File Tracking** - Processed files are tracked in localStorage to avoid reprocessing

## Required Environment Variables

Copy `.env.example` to `.env` and fill in your API keys:

```bash
# Google APIs
VITE_GOOGLE_API_KEY=your_google_api_key_here
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
VITE_GOOGLE_DRIVE_FOLDER_ID=your_google_drive_folder_id_here

# LlamaParse API
VITE_LLAMAPARSE_API_KEY=your_llamaparse_api_key_here

# Optional Configuration
VITE_LLAMAPARSE_BATCH_SIZE=10
VITE_PROCESSING_TIMEOUT=300000
```

## Getting Your LlamaParse API Key

1. Go to [LlamaIndex Cloud](https://cloud.llamaindex.ai/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `llx-`)

## Features Added

### ✅ **Batch Processing**
- Process up to 10 PDFs simultaneously with LlamaParse
- Real-time progress tracking with file-by-file status updates

### ✅ **Processed File Tracking**
- Files are marked as "Processed" in the selection interface
- Prevents accidental reprocessing of the same documents
- Uses localStorage for frontend-only tracking

### ✅ **Enhanced Error Handling**
- Individual file error tracking
- Partial success handling (some files can fail while others succeed)
- Detailed error messages for debugging

### ✅ **Progress Visualization**
- Multi-stage progress tracking (LlamaParse → Gemini → Saving)
- File-by-file status updates
- Processing statistics and timing

## File Structure Requirements

Your Google Drive should be organized as:
```
Your Main Folder/
├── INPUT/
│   ├── AAPL/          # PDF files to process
│   ├── GOOGL/         # PDF files to process
│   └── MSFT/          # PDF files to process
└── OUTPUT/
    ├── AAPL/          # Processed data/sheets
    ├── GOOGL/         # Processed data/sheets
    └── MSFT/          # Processed data/sheets
```

## Usage

1. Click **"Process from Drive"** in the main menu
2. Select a stock that exists in OUTPUT folders
3. Choose PDFs from the corresponding INPUT/{stock-name} folder
4. Files marked with ✅ "Processed" have been handled before
5. Click **"Process Selected Files"** to start the workflow
6. Monitor progress through the three stages
7. Review and save results to Google Sheets

## MCP Integration

This application also supports **Model Context Protocol (MCP)** for integration with Claude Code and other MCP-compatible clients.

### Quick MCP Setup:
```bash
# Run the setup script
./setup-mcp.sh

# Or manually install MCP servers
npm run mcp:install
```

### Benefits of MCP Integration:
- **Direct Claude Code Integration**: Use Claude Code to directly parse PDFs and manage Google Drive files
- **Seamless Workflow**: Claude can orchestrate the entire financial data processing workflow
- **No Frontend Required**: Process files directly through Claude without using the web interface

For detailed MCP setup instructions, see [`MCP_SETUP.md`](./MCP_SETUP.md).

## Troubleshooting

### Common Issues:
- **LlamaParse API Error**: Check your API key is correct and has sufficient credits
- **File Processing Timeout**: Increase `VITE_PROCESSING_TIMEOUT` for large files
- **Batch Size Issues**: Reduce `VITE_LLAMAPARSE_BATCH_SIZE` if hitting rate limits
- **Google Drive Errors**: Ensure proper folder structure and permissions

### Debug Tips:
- Check browser console for detailed error messages
- Verify all environment variables are set correctly
- Test with a small batch of files first
- Clear processed files tracking: `localStorage.removeItem('financial-data-puncher-processed-files')`