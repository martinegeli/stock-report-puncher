# MCP (Model Context Protocol) Setup

This document explains how to set up MCP servers for LlamaParse and Google services to work with Claude Code and other MCP-compatible clients.

## Overview

The MCP servers provide:
- **LlamaParse Server**: PDF parsing capabilities via LlamaIndex
- **Google Drive Server**: File management and access to your Google Drive
- **Google Sheets Server**: Spreadsheet creation and manipulation

## Prerequisites

1. **Node.js** (v18 or higher)
2. **API Keys**:
   - LlamaParse API key from [LlamaIndex Cloud](https://cloud.llamaindex.ai/)
   - Google API credentials from [Google Cloud Console](https://console.cloud.google.com/)

## Installation

### 1. Install MCP Server Packages

```bash
npm run mcp:install
```

This installs the required MCP server packages globally:
- `@llamaindex/mcp-server-llamaparse`
- `@modelcontextprotocol/server-google-drive`
- `@modelcontextprotocol/server-google-sheets`

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
```bash
# LlamaParse
VITE_LLAMAPARSE_API_KEY=llx-your-llamaparse-api-key

# Google APIs
VITE_GOOGLE_API_KEY=your-google-api-key
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
VITE_GOOGLE_DRIVE_FOLDER_ID=your-main-folder-id
```

## Claude Desktop Configuration

Add this to your Claude Desktop `claude_desktop_config.json`:

### macOS Location:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

### Windows Location:
```
%APPDATA%/Claude/claude_desktop_config.json
```

### Configuration:
```json
{
  "mcpServers": {
    "llamaparse": {
      "command": "npx",
      "args": ["@llamaindex/mcp-server-llamaparse"],
      "env": {
        "LLAMAINDEX_API_KEY": "llx-your-llamaparse-api-key"
      }
    },
    "google-drive": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-google-drive"],
      "env": {
        "GOOGLE_API_KEY": "your-google-api-key",
        "GOOGLE_CLIENT_ID": "your-client-id.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "your-google-client-secret",
        "GOOGLE_FOLDER_ID": "your-main-folder-id"
      }
    },
    "google-sheets": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-google-sheets"],
      "env": {
        "GOOGLE_API_KEY": "your-google-api-key",
        "GOOGLE_CLIENT_ID": "your-client-id.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "your-google-client-secret"
      }
    }
  }
}
```

## Google API Setup

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google Drive API
   - Google Sheets API
   - Google Docs API (optional)

### 2. Create Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **API Key**
3. Copy the API key (this is your `GOOGLE_API_KEY`)
4. Click **Create Credentials** → **OAuth 2.0 Client IDs**
5. Choose **Web application**
6. Add authorized redirect URIs:
   - `http://localhost:3000`
   - `https://your-domain.com` (if deploying)
7. Copy the Client ID and Client Secret

### 3. Set Up OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type
3. Fill in required information
4. Add your email to test users
5. Add the following scopes:
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/spreadsheets`

## Testing MCP Servers

Test each server individually:

### LlamaParse Server
```bash
npm run mcp:llamaparse
```

### Google Drive Server
```bash
npm run mcp:google-drive
```

### Google Sheets Server
```bash
npm run mcp:google-sheets
```

## Usage with Claude Code

Once configured, you can use MCP servers in Claude Code:

### Available Tools

**LlamaParse:**
- `mcp__llamaparse_parse_pdf` - Parse PDF files to structured data
- `mcp__llamaparse_get_job_status` - Check parsing job status

**Google Drive:**
- `mcp__google_drive_list_files` - List files in folders
- `mcp__google_drive_download_file` - Download files
- `mcp__google_drive_upload_file` - Upload files
- `mcp__google_drive_create_folder` - Create folders

**Google Sheets:**
- `mcp__google_sheets_create_spreadsheet` - Create new spreadsheets
- `mcp__google_sheets_read_range` - Read data from ranges
- `mcp__google_sheets_update_range` - Update cell values
- `mcp__google_sheets_append_rows` - Add new rows

### Example Usage

```bash
# In Claude Code, you can now say:
"Parse this PDF using LlamaParse and save the results to a new Google Sheet"

# Claude will automatically use the MCP tools:
# 1. mcp__llamaparse_parse_pdf
# 2. mcp__google_sheets_create_spreadsheet
# 3. mcp__google_sheets_update_range
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Ensure API keys have proper permissions
   - Check OAuth consent screen configuration

2. **Server Not Found**
   - Verify MCP servers are installed globally
   - Check Claude Desktop configuration file path

3. **Authentication Errors**
   - Verify all environment variables are set correctly
   - Ensure Google APIs are enabled in Cloud Console

### Debug Tips

1. **Check Server Status**:
   ```bash
   npx @llamaindex/mcp-server-llamaparse --version
   ```

2. **Verify Environment Variables**:
   ```bash
   echo $VITE_LLAMAPARSE_API_KEY
   ```

3. **Test API Access**:
   ```bash
   curl -H "Authorization: Bearer $VITE_LLAMAPARSE_API_KEY" \
        https://api.cloud.llamaindex.ai/api/health
   ```

## Security Notes

- Never commit real API keys to version control
- Use environment variables for all sensitive credentials
- Restrict API key permissions in Google Cloud Console
- Consider using service accounts for production deployments

## Integration Benefits

With MCP servers configured, Claude Code can:
- Directly parse PDFs without your frontend application
- Access and manipulate Google Drive files
- Create and update Google Sheets programmatically
- Provide seamless integration between services
- Work with your financial data processing workflow end-to-end