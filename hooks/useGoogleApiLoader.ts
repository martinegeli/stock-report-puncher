import { useState, useEffect } from 'react';

// This hook loads the Google API (gapi) and Google Identity Services (gis) client scripts.
export const useGoogleApiLoader = () => {
  const [isGapiReady, setIsGapiReady] = useState(false);
  const [isGsiReady, setIsGsiReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const gapiScriptId = 'gapi-script';
    const gsiScriptId = 'gsi-script';
    
    // Avoid appending scripts if they already exist
    if (document.getElementById(gapiScriptId) && document.getElementById(gsiScriptId)) {
      setIsGapiReady(true);
      setIsGsiReady(true);
      return;
    }
    
    const gapiScript = document.createElement('script');
    gapiScript.id = gapiScriptId;
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => setIsGapiReady(true);
    gapiScript.onerror = () => {
      setError('Failed to load the Google API script.');
      setIsLoading(false);
    };
    document.body.appendChild(gapiScript);

    const gsiScript = document.createElement('script');
    gsiScript.id = gsiScriptId;
    gsiScript.src = 'https://accounts.google.com/gsi/client';
    gsiScript.async = true;
    gsiScript.defer = true;
    gsiScript.onload = () => setIsGsiReady(true);
    gsiScript.onerror = () => {
      setError('Failed to load the Google Identity Services script.');
      setIsLoading(false);
    };
    document.body.appendChild(gsiScript);
    
    // Cleanup function to remove scripts if the component unmounts
    return () => {
      const gapiEl = document.getElementById(gapiScriptId);
      const gsiEl = document.getElementById(gsiScriptId);
      if (gapiEl) document.body.removeChild(gapiEl);
      if (gsiEl) document.body.removeChild(gsiEl);
    };
  }, []);

  useEffect(() => {
    if (isGapiReady && isGsiReady) {
      setIsLoading(false);
    }
  }, [isGapiReady, isGsiReady]);

  return { 
    isReady: isGapiReady && isGsiReady, 
    isLoading,
    error,
  };
};