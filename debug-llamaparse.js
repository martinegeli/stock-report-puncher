// Debug script to test LlamaParse API directly
// Run this in the browser console to test the API call

async function debugLlamaParse() {
  const LLAMAPARSE_API_KEY = 'llama-api-key';
  const LLAMAPARSE_BASE_URL = 'https://api.cloud.llamaindex.ai/api/parsing';
  
  console.log('Testing LlamaParse API connection...');
  
  // Test 1: Check API key format
  console.log('API Key format:', LLAMAPARSE_API_KEY.substring(0, 10) + '...');
  
  // Test 2: Try a simple API call to check authentication
  try {
    const testResponse = await fetch(`${LLAMAPARSE_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`,
      },
    });
    
    console.log('Health check status:', testResponse.status);
    if (testResponse.ok) {
      console.log('✅ API key authentication successful');
    } else {
      console.log('❌ API key authentication failed');
      const errorText = await testResponse.text();
      console.log('Error details:', errorText);
    }
  } catch (error) {
    console.log('❌ Network error during health check:', error);
  }
  
  // Test 3: Create a minimal test file
  console.log('\nTesting file upload...');
  
  // Create a minimal PDF-like blob for testing
  const testContent = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n179\n%%EOF';
  const testFile = new File([testContent], 'test.pdf', { type: 'application/pdf' });
  
  const formData = new FormData();
  formData.append('file', testFile);
  formData.append('language', 'en');
  formData.append('parsing_instruction', 'Extract all text content');
  formData.append('result_type', 'json');
  formData.append('verbose', 'true');
  
  try {
    const uploadResponse = await fetch(`${LLAMAPARSE_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`,
      },
      body: formData,
    });
    
    console.log('Upload response status:', uploadResponse.status);
    console.log('Upload response headers:', Object.fromEntries(uploadResponse.headers.entries()));
    
    if (uploadResponse.ok) {
      const result = await uploadResponse.json();
      console.log('✅ Upload successful:', result);
    } else {
      const errorText = await uploadResponse.text();
      console.log('❌ Upload failed');
      console.log('Response body:', errorText);
      
      // Try to parse as JSON if possible
      try {
        const errorJson = JSON.parse(errorText);
        console.log('Parsed error:', errorJson);
      } catch (e) {
        console.log('Error response is not JSON');
      }
    }
  } catch (error) {
    console.log('❌ Network error during upload:', error);
  }
}

// Run the debug test
debugLlamaParse();
