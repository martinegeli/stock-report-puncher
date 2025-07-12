// Simple test script to verify Google configuration
// Run this with: node test-config.js

console.log('🔍 Testing Google Configuration...\n');

// Check if config file exists and has proper structure
try {
  const fs = require('fs');
  const configContent = fs.readFileSync('./config.ts', 'utf8');
  
  console.log('✅ Config file found');
  
  // Check for placeholder values
  const hasPlaceholders = configContent.includes('YOUR_GOOGLE_API_KEY_HERE') ||
                         configContent.includes('YOUR_GOOGLE_CLIENT_ID_HERE') ||
                         configContent.includes('YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE');
  
  if (hasPlaceholders) {
    console.log('⚠️  WARNING: Placeholder values detected in config.ts');
    console.log('   Please update with your actual Google credentials');
    console.log('   See GOOGLE_SETUP_GUIDE.md for instructions\n');
  } else {
    console.log('✅ No placeholder values detected\n');
  }
  
} catch (error) {
  console.log('❌ Error reading config.ts:', error.message);
}

// Check for .env file
try {
  const fs = require('fs');
  if (fs.existsSync('./.env')) {
    console.log('✅ .env file found');
    const envContent = fs.readFileSync('./.env', 'utf8');
    
    const hasEnvCredentials = envContent.includes('VITE_GOOGLE_API_KEY=') &&
                             envContent.includes('VITE_GOOGLE_CLIENT_ID=') &&
                             envContent.includes('VITE_GOOGLE_DRIVE_FOLDER_ID=');
    
    if (hasEnvCredentials) {
      console.log('✅ Environment variables configured');
    } else {
      console.log('⚠️  Some environment variables may be missing');
    }
  } else {
    console.log('ℹ️  No .env file found (using config.ts values)');
  }
} catch (error) {
  console.log('❌ Error checking .env file:', error.message);
}

console.log('\n📋 Next Steps:');
console.log('1. Follow GOOGLE_SETUP_GUIDE.md to set up Google Cloud Console');
console.log('2. Update your credentials in config.ts or .env file');
console.log('3. Run "npm run dev" to start the application');
console.log('4. Test the Google sign-in functionality'); 