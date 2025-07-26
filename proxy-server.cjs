const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const FormData = require('form-data');
const multer = require('multer');

const app = express();
const upload = multer();

// Enable CORS for your frontend
app.use(cors({
  origin: 'http://localhost:5173', // Your Vite dev server
  credentials: true
}));

app.use(express.json());

const LLAMAPARSE_BASE_URL = 'https://api.cloud.llamaindex.ai/api/parsing';

// Proxy upload endpoint
app.post('/api/llamaparse/upload', upload.single('file'), async (req, res) => {
  try {
    const { file } = req;
    const { language, parsing_instruction, result_type, verbose } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const formData = new FormData();
    formData.append('file', file.buffer, { filename: file.originalname });
    formData.append('language', language || 'en');
    formData.append('parsing_instruction', parsing_instruction || '');
    formData.append('result_type', result_type || 'json');
    formData.append('verbose', verbose || 'true');

    const response = await fetch(`${LLAMAPARSE_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization,
        ...formData.getHeaders()
      },
      body: formData,
    });

    const result = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Proxy upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Proxy job status endpoint
app.get('/api/llamaparse/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const response = await fetch(`${LLAMAPARSE_BASE_URL}/job/${jobId}`, {
      headers: {
        'Authorization': req.headers.authorization,
      },
    });

    const result = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Proxy job status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`LlamaParse proxy server running on port ${PORT}`);
});