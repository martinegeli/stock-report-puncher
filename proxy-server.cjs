const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const FormData = require('form-data');
const multer = require('multer');

const app = express();
const upload = multer();

// Enable CORS for your frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'], // Your Vite dev server (handles both common ports)
  credentials: true
}));

app.use(express.json());

const LLAMAPARSE_BASE_URL = 'https://api.cloud.llamaindex.ai/api/parsing';

// Proxy upload endpoint
app.post('/api/llamaparse/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Received upload request:', {
      fileSize: req.file?.size,
      fileName: req.file?.originalname,
      headers: Object.keys(req.headers),
      body: Object.keys(req.body)
    });

    const { file } = req;
    const { language, parsing_instruction, result_type, verbose } = req.body;
    
    if (!file) {
      console.error('No file provided in request');
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!req.headers.authorization) {
      console.error('No authorization header provided');
      return res.status(401).json({ error: 'No authorization header provided' });
    }

    const formData = new FormData();
    formData.append('file', file.buffer, { 
      filename: file.originalname,
      contentType: 'application/pdf'
    });
    formData.append('language', language || 'en');
    formData.append('parsing_instruction', parsing_instruction || '');
    formData.append('result_type', result_type || 'json');
    formData.append('verbose', verbose || 'true');

    console.log('Sending FormData to LlamaParse with:', {
      fileSize: file.buffer.length,
      fileName: file.originalname,
      language: language || 'en',
      resultType: result_type || 'json'
    });

    console.log('Making request to LlamaParse API...');
    const response = await fetch(`${LLAMAPARSE_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization,
        ...formData.getHeaders()
      },
      body: formData,
    });

    console.log('LlamaParse API response status:', response.status);
    const result = await response.json();
    console.log('LlamaParse API response:', result);
    
    if (!response.ok) {
      console.error('LlamaParse API error:', response.status, result);
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Proxy upload error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Proxy job status endpoint
app.get('/api/llamaparse/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log('Checking job status for:', jobId);
    
    if (!req.headers.authorization) {
      console.error('No authorization header provided for job status');
      return res.status(401).json({ error: 'No authorization header provided' });
    }
    
    const response = await fetch(`${LLAMAPARSE_BASE_URL}/job/${jobId}`, {
      headers: {
        'Authorization': req.headers.authorization,
      },
    });

    console.log('Job status response:', response.status);
    const result = await response.json();
    console.log('Job status result:', result);
    
    if (!response.ok) {
      console.error('Job status API error:', response.status, result);
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Proxy job status error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Proxy result endpoint
app.get('/api/llamaparse/result/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log('Fetching result for job:', jobId);
    
    if (!req.headers.authorization) {
      console.error('No authorization header provided for result');
      return res.status(401).json({ error: 'No authorization header provided' });
    }
    
    const response = await fetch(`${LLAMAPARSE_BASE_URL}/result/${jobId}`, {
      headers: {
        'Authorization': req.headers.authorization,
      },
    });

    console.log('Result response status:', response.status);
    
    if (!response.ok) {
      console.error('Result API error:', response.status);
      return res.status(response.status).json({ error: 'Failed to fetch result' });
    }

    const result = await response.json();
    console.log('Result data received:', {
      type: typeof result,
      hasData: !!result,
      keys: typeof result === 'object' ? Object.keys(result) : [],
      dataLength: result ? JSON.stringify(result).length : 0
    });
    
    res.json(result);
  } catch (error) {
    console.error('Proxy result error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Proxy alternative results endpoint (plural)
app.get('/api/llamaparse/results/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log('Fetching results (plural) for job:', jobId);
    
    if (!req.headers.authorization) {
      console.error('No authorization header provided for results');
      return res.status(401).json({ error: 'No authorization header provided' });
    }
    
    const response = await fetch(`${LLAMAPARSE_BASE_URL}/results/${jobId}`, {
      headers: {
        'Authorization': req.headers.authorization,
      },
    });

    console.log('Results response status:', response.status);
    
    if (!response.ok) {
      console.error('Results API error:', response.status);
      return res.status(response.status).json({ error: 'Failed to fetch results' });
    }

    const result = await response.json();
    console.log('Results data received:', {
      type: typeof result,
      hasData: !!result,
      keys: typeof result === 'object' ? Object.keys(result) : [],
      dataLength: result ? JSON.stringify(result).length : 0
    });
    
    res.json(result);
  } catch (error) {
    console.error('Proxy results error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Additional endpoint patterns to try
app.get('/api/llamaparse/job/:jobId/result', async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log('Fetching result via job/result pattern for:', jobId);
    
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }
    
    const response = await fetch(`${LLAMAPARSE_BASE_URL}/job/${jobId}/result`, {
      headers: {
        'Authorization': req.headers.authorization,
      },
    });

    console.log('Job/result response status:', response.status);
    
    if (!response.ok) {
      console.error('Job/result API error:', response.status);
      return res.status(response.status).json({ error: 'Failed to fetch job result' });
    }

    const result = await response.json();
    console.log('Job/result data received:', {
      type: typeof result,
      hasData: !!result,
      keys: typeof result === 'object' ? Object.keys(result) : []
    });
    
    res.json(result);
  } catch (error) {
    console.error('Proxy job/result error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// LlamaParse markdown result endpoint
app.get('/api/llamaparse/job/:jobId/result/markdown', async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log('Fetching markdown result for job:', jobId);
    
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }
    
    const response = await fetch(`${LLAMAPARSE_BASE_URL}/job/${jobId}/result/markdown`, {
      headers: {
        'Authorization': req.headers.authorization,
      },
    });

    console.log('Markdown result response status:', response.status);
    
    if (!response.ok) {
      console.error('Markdown result API error:', response.status);
      return res.status(response.status).json({ error: 'Failed to fetch markdown result' });
    }

    const result = await response.json();
    console.log('Markdown result data received:', {
      type: typeof result,
      hasData: !!result,
      keys: typeof result === 'object' ? Object.keys(result) : [],
      dataLength: result ? JSON.stringify(result).length : 0
    });
    
    res.json(result);
  } catch (error) {
    console.error('Proxy markdown result error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// LlamaParse JSON result endpoint (if they have one)
app.get('/api/llamaparse/job/:jobId/result/json', async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log('Fetching JSON result for job:', jobId);
    
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }
    
    const response = await fetch(`${LLAMAPARSE_BASE_URL}/job/${jobId}/result/json`, {
      headers: {
        'Authorization': req.headers.authorization,
      },
    });

    console.log('JSON result response status:', response.status);
    
    if (!response.ok) {
      console.error('JSON result API error:', response.status);
      return res.status(response.status).json({ error: 'Failed to fetch JSON result' });
    }

    const result = await response.json();
    console.log('JSON result data received:', {
      type: typeof result,
      hasData: !!result,
      keys: typeof result === 'object' ? Object.keys(result) : [],
      dataLength: result ? JSON.stringify(result).length : 0
    });
    
    res.json(result);
  } catch (error) {
    console.error('Proxy JSON result error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`LlamaParse proxy server running on port ${PORT}`);
});