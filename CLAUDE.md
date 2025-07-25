# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev      # Start Vite development server (localhost:5173)
npm run proxy    # Start LlamaParse proxy server (localhost:3001) - REQUIRED for LlamaParse
npm run build    # Create production build
npm run preview  # Preview production build locally
```

**Important**: You must run BOTH `npm run dev` AND `npm run proxy` in separate terminals for the application to work properly.

## Architecture Overview

**Stock Report Puncher** is a React-TypeScript application that processes financial PDF documents through a multi-stage pipeline: **LlamaParse → Gemini AI → Google Sheets**. The app follows a service-oriented architecture with centralized state management.

### Core Processing Pipeline

1. **PDF Ingestion**: Users select PDFs from Google Drive INPUT folders or upload directly
2. **LlamaParse Stage**: Batch processing (up to 10 files) extracts raw table data from PDFs
3. **User Review Stage**: `LlamaParseReview` component allows users to select CREATE vs UPDATE mode
4. **Gemini Processing**: AI analyzes table data and creates structured financial datasets with intelligent batching
5. **Google Sheets Export**: Data written in 2D array format directly compatible with Google Sheets API

### Service Layer Architecture

**Google Service** (`services/googleService.ts`)
- OAuth 2.0 authentication and session management
- Google Drive operations (folder creation, file listing, downloads)
- Google Sheets operations (batch updates, cell management)
- Comprehensive error parsing for Google API responses

**LlamaParse Service** (`services/llamaParseService.ts`)
- Generic table extraction from PDFs (no financial interpretation)
- Batch processing with real-time progress tracking via proxy server
- Async job polling with configurable timeouts and multiple endpoint fallbacks
- Individual file error handling with partial success support

**Gemini Service** (`services/geminiService.ts`) 
- **Intelligent Batching Strategy**: CREATE mode uses single file, UPDATE mode processes one-at-a-time
- **Financial Intelligence Layer**: Analyzes raw table data to identify and extract financial statements
- **Schema-validated Output**: Returns Google Sheets-ready 2D array format (`{headers: [], rows: []}`)
- **Context-aware Processing**: Reads existing sheet structure for UPDATE mode matching

**Storage Service** (`services/storageService.ts`)
- Session-based intermediate data storage between parsing stages
- Document metadata tracking with confidence scoring
- LocalStorage persistence with Google Drive integration hooks

### Configuration Requirements

Required environment variables in `.env`:

```bash
# Google Cloud Console credentials
VITE_GOOGLE_API_KEY=          # API key with Drive/Sheets/Gemini access
VITE_GOOGLE_CLIENT_ID=        # OAuth 2.0 client ID
VITE_GOOGLE_DRIVE_FOLDER_ID=  # Root folder for stock data organization

# LlamaParse integration  
VITE_LLAMAPARSE_API_KEY=      # LlamaIndex Cloud API key (starts with llx-)

# Optional performance tuning
VITE_LLAMAPARSE_BATCH_SIZE=10    # Default batch size for PDF processing
VITE_PROCESSING_TIMEOUT=300000   # 5 minute timeout for operations
```

See `GOOGLE_SETUP_GUIDE.md` for detailed Google Cloud Console setup including API enablement and OAuth configuration.

### State Management Pattern

**Centralized State**: App.tsx manages all application state using React hooks with view-based routing through AppView enum.

**Key State Flow**:
- `view` controls which component renders (AUTHENTICATING → SELECTION_MENU → PROCESSING → **LLAMAPARSE_REVIEW** → SUCCESS)
- `currentProcessingStage` tracks pipeline progress ('llamaparse' | 'gemini' | 'saving')
- `llamaParseResults` stores raw table data between LlamaParse and Gemini stages
- **User control point**: `LlamaParseReview` allows users to choose processing mode before Gemini
- Processing progress flows through real-time updates via callback functions

### Google Drive Folder Structure

```
Main Drive Folder/
├── INPUT/
│   ├── {STOCK}/              # PDFs to process
│   └── {STOCK}/
├── OUTPUT/                   # Generated by app
│   ├── {STOCK}/              # Processed results  
│   └── {STOCK}/
└── Individual Stock Folders/ # User-created via app
    ├── {TICKER}/
    │   └── Financials        # Google Sheet with extracted data
    └── {TICKER}/
```

### Component Architecture

**Processing Flow Components**:
- `SelectionMenu`: Three-path entry (New Upload/Update Existing/Process from Drive)
- `ProcessingProgress`: Multi-stage visualization with file-by-file tracking
- `LlamaParseReview`: **Critical user decision point** - review parsed files and choose CREATE vs UPDATE mode
- `DataTable`: Results display with Google Sheets integration and save functionality

**Data Handling**:
- Components receive data through props from centralized App state
- Service calls are made through App component methods
- Error states are handled consistently across all views

### Financial Data Processing Logic

**CREATE Mode**: Establish comprehensive financial structure (SINGLE FILE ONLY)
- **Uses only the first file** to establish clean line item structure
- **Analyzes raw table data** from LlamaParse to identify financial statements
- **Extracts ALL line items** with standardized terminology and chronological arrangement
- **Returns Google Sheets format**: `{headers: ["Line Item", "2022", "2023"], rows: [["Revenue", "123", "456"]]}`
- **Warns if multiple files provided**: Recommends using UPDATE mode for additional files

**UPDATE Mode**: Add new time periods sequentially (ONE-AT-A-TIME PROCESSING)
- **Reads existing sheet structure** automatically from Google Sheets
- **Processes files sequentially** to avoid Gemini API limits
- **Intelligent line item matching** handles naming variations
- **Adds only new periods** as additional columns to existing structure
- **Maintains data consistency** with existing naming conventions and units

### Error Handling Strategy

**Layered Error Management**:
- Service-level: Detailed Google API error parsing and recovery
- Processing-level: Partial success handling (some files can fail while others succeed)
- UI-level: User-friendly error messages with actionable guidance
- Storage-level: Session state tracking for recovery scenarios

**Key Debugging Points**:
- All services include comprehensive console logging
- Processing statistics track files/line items/periods found
- LlamaParse progress includes per-file status tracking
- localStorage preserves processed file history to prevent reprocessing

### TypeScript Interfaces

**Core Data Types**:
- `FinancialDataItem`: Individual extracted financial data points
- `ParsedFinancialDocument`: Structured storage for parsed documents with metadata
- `BatchProcessingProgress`: Real-time progress tracking for batch operations
- `LlamaParseResult`: Individual file processing results with status/confidence

### Integration Points

**Google APIs**: Requires enabled Drive API, Sheets API, and Gemini API with proper OAuth scope configuration.

**LlamaParse**: Batch processing with configurable limits and timeout handling.

**Storage System**: Designed for future Google Drive persistence expansion beyond current localStorage implementation.