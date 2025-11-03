// Vercel Serverless Function to proxy Airtable API calls
// The API key is stored server-side only (Vercel env vars, not VITE_)

import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local manually if in development and env vars not set
function loadLocalEnv() {
  try {
    if (typeof process.env.AIRTABLE_API_KEY === 'undefined') {
      const envPath = join(process.cwd(), '.env.local');
      const envContent = readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const match = line.match(/^([^#][^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  } catch (e) {
    // .env.local might not exist, that's ok
  }
}

// Load env on module load
loadLocalEnv();

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { path, method = 'GET', body } = req.body;

  if (!path) {
    return res.status(400).json({ error: 'Missing path' });
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const DEFAULT_BASE_ID = process.env.AIRTABLE_BASE_ID;

  // Debug: log available env vars (remove in production)
  console.log('Environment check:', {
    hasApiKey: !!AIRTABLE_API_KEY,
    hasBaseId: !!DEFAULT_BASE_ID,
    envKeys: Object.keys(process.env).filter(k => k.includes('AIRTABLE'))
  });

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ 
      error: 'Server configuration missing: AIRTABLE_API_KEY',
      hint: 'Make sure AIRTABLE_API_KEY is in .env.local file in the selfhosted/ directory'
    });
  }

  try {
    // Path can be either "table/record" (uses default base) or "baseId/table/record" (specified base)
    const pathParts = path.split('/');
    let baseId, tablePath;
    
    // Check if first part looks like a base ID (starts with "app")
    if (pathParts[0]?.startsWith('app') && pathParts.length > 1) {
      baseId = pathParts[0];
      tablePath = pathParts.slice(1).join('/');
    } else {
      // Use default base
      if (!DEFAULT_BASE_ID) {
        return res.status(500).json({ error: 'Server configuration missing: AIRTABLE_BASE_ID' });
      }
      baseId = DEFAULT_BASE_ID;
      tablePath = path;
    }

    const url = `https://api.airtable.com/v0/${baseId}/${tablePath}`;
    
    const headers = {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    };

    const options = {
      method,
      headers
    };

    if (body && (method === 'PATCH' || method === 'POST')) {
      options.body = JSON.stringify(body);
    }

    if (req.body.queryParams && Object.keys(req.body.queryParams).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(req.body.queryParams)) {
        if (Array.isArray(value)) {
          // Handle array params like fields[]=val1&fields[]=val2
          for (const v of value) {
            params.append(key, v);
          }
        } else {
          params.append(key, value);
        }
      }
      const finalUrl = `${url}?${params.toString()}`;
      const response = await fetch(finalUrl, options);
      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      return res.status(200).json(data);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Airtable proxy error:', error);
    return res.status(500).json({ error: error.message || 'Proxy error' });
  }
}
