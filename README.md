# Stock Report Puncher

A React application that extracts financial data from PDF reports and exports it to Google Sheets.

## Features

- Upload PDF financial reports (10-K, 10-Q, etc.)
- Extract financial data using Google's Gemini AI
- Create organized Google Drive folders for each stock ticker
- Export extracted data to Google Sheets with proper formatting
- Modern, responsive UI built with React and Tailwind CSS

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd stock-report-puncher
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Google Cloud Console**
   - Follow the detailed setup guide in [GOOGLE_SETUP_GUIDE.md](./GOOGLE_SETUP_GUIDE.md)
   - This includes enabling APIs, creating credentials, and setting up OAuth

4. **Configure your credentials**
   
   **Option A: Environment Variables (Recommended)**
   ```bash
   # Create a .env file
   cp .env.example .env
   # Edit .env with your actual credentials
   ```

   **Option B: Direct Configuration**
   - Edit `config.ts` and replace the placeholder values with your actual credentials

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   - Navigate to `http://localhost:5173`
   - Sign in with Google
   - Start uploading PDF reports!

## Configuration

The application requires three main Google credentials:

- **API Key**: For accessing Google Drive, Sheets, and Gemini APIs
- **OAuth Client ID**: For user authentication
- **Drive Folder ID**: The Google Drive folder where stock folders will be created

See [GOOGLE_SETUP_GUIDE.md](./GOOGLE_SETUP_GUIDE.md) for detailed setup instructions.

## Development

- Built with React 19, TypeScript, and Vite
- Uses Google APIs for authentication and data storage
- Tailwind CSS for styling
- Google Gemini AI for PDF text extraction and analysis

## Security Notes

- Never commit real credentials to version control
- Use environment variables for production deployments
- Restrict API keys to specific domains and APIs
- Regularly monitor usage in Google Cloud Console
