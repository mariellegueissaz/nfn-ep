// Vercel Serverless Function to proxy Airtable API calls
// SECURITY: Whitelist-based access control, Firebase auth verification, input validation

import { readFileSync } from 'fs';
import { join } from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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

loadLocalEnv();

// Initialize Firebase Admin (for token verification)
let firebaseAdminInitialized = false;
let firebaseAdminError = null;
function initFirebaseAdmin() {
  if (firebaseAdminInitialized) return;
  if (firebaseAdminError) return; // Don't retry if already failed
  
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    // Check if service account is missing or empty
    if (!serviceAccount || serviceAccount.trim() === '') {
      if (process.env.VERCEL) {
        firebaseAdminError = 'FIREBASE_SERVICE_ACCOUNT environment variable is not set or is empty';
        console.error('Firebase Admin error:', firebaseAdminError);
      }
      return;
    }
    
    let serviceAccountJson;
    try {
      serviceAccountJson = JSON.parse(serviceAccount);
    } catch (parseError) {
      firebaseAdminError = `Failed to parse FIREBASE_SERVICE_ACCOUNT JSON: ${parseError.message}. Make sure the JSON is valid and properly formatted.`;
      console.error('Firebase Admin JSON parse error:', firebaseAdminError);
      return;
    }
    
    // Validate required fields in service account
    if (!serviceAccountJson.project_id || !serviceAccountJson.private_key || !serviceAccountJson.client_email) {
      firebaseAdminError = 'FIREBASE_SERVICE_ACCOUNT JSON is missing required fields (project_id, private_key, or client_email)';
      console.error('Firebase Admin error:', firebaseAdminError);
      return;
    }
    
    try {
      if (!getApps().length) {
        initializeApp({
          credential: cert(serviceAccountJson)
        });
      }
      firebaseAdminInitialized = true;
      console.log('Firebase Admin initialized successfully');
    } catch (initError) {
      firebaseAdminError = `Firebase Admin initialization failed: ${initError.message}`;
      console.error('Firebase Admin init error:', firebaseAdminError);
    }
  } catch (e) {
    firebaseAdminError = `Unexpected error during Firebase Admin setup: ${e.message}`;
    console.error('Firebase Admin unexpected error:', firebaseAdminError);
  }
}

// Whitelist of allowed bases and tables (SECURITY: prevents table name guessing)
const ALLOWED_BASES = (process.env.ALLOWED_BASES || '').split(',').filter(Boolean);
const ALLOWED_TABLES = (process.env.ALLOWED_TABLES || '').split(',').filter(Boolean);

// Rate limiting (simple in-memory store - use Redis in production for multi-instance)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP

function checkRateLimit(ip) {
  const now = Date.now();
  const key = ip;
  const record = rateLimitStore.get(key);
  
  if (!record || now - record.resetTime > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(key, { count: 1, resetTime: now });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  record.count++;
  return true;
}

// Verify Firebase token
async function verifyFirebaseToken(idToken) {
  if (!idToken) return null;
  
  try {
    initFirebaseAdmin();
    if (!firebaseAdminInitialized) {
      // If we have a specific error, it will be handled by the main handler
      if (firebaseAdminError) {
        return null;
      }
      // In production (Vercel), require Firebase Admin
      if (process.env.VERCEL) {
        console.warn('Firebase Admin not configured in production - authentication disabled');
        return null;
      }
      // Dev mode: allow without verification
      return { uid: 'dev-user', email: 'dev@localhost' };
    }
    
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
}

// Validate and sanitize path
function validatePath(path) {
  if (!path || typeof path !== 'string') return null;
  
  // Remove any path traversal attempts
  if (path.includes('..') || path.includes('//')) return null;
  
  // Only allow alphanumeric, hyphens, underscores, and forward slashes
  if (!/^[a-zA-Z0-9_\-/]+$/.test(path)) return null;
  
  return path.trim();
}

// Validate base ID
function validateBaseId(baseId) {
  if (!baseId || typeof baseId !== 'string') return false;
  if (!baseId.startsWith('app')) return false;
  if (ALLOWED_BASES.length > 0 && !ALLOWED_BASES.includes(baseId)) {
    return false;
  }
  return /^app[a-zA-Z0-9]+$/.test(baseId);
}

// Validate table name/ID
function validateTableName(tableName) {
  if (!tableName || typeof tableName !== 'string') return false;
  if (ALLOWED_TABLES.length > 0 && !ALLOWED_TABLES.includes(tableName)) {
    return false;
  }
  // Allow table IDs (tbl...) or table names (alphanumeric, spaces, hyphens)
  return /^(tbl[a-zA-Z0-9]+|[a-zA-Z0-9\s\-_]+)$/.test(tableName);
}

export default async function handler(req, res) {
  try {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limiting
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    // Initialize Firebase Admin early to catch configuration errors
    initFirebaseAdmin();
    
    // Check for Firebase Admin initialization errors
    if (firebaseAdminError) {
      return res.status(500).json({ 
        error: `Server configuration error: ${firebaseAdminError}. Please check your FIREBASE_SERVICE_ACCOUNT environment variable in Vercel.` 
      });
    }
    
    // In production, require Firebase Service Account
    if (process.env.VERCEL && !process.env.FIREBASE_SERVICE_ACCOUNT) {
      return res.status(500).json({ 
        error: 'Server configuration error: FIREBASE_SERVICE_ACCOUNT environment variable is not set. Please configure Firebase Admin in Vercel environment variables.' 
      });
    }

    // Verify Firebase authentication
    const authHeader = req.headers.authorization;
    const idToken = authHeader?.replace('Bearer ', '');
    const user = await verifyFirebaseToken(idToken);
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing authentication token' });
    }

  const { path, method = 'GET', body } = req.body;

  // Validate path
  const sanitizedPath = validatePath(path);
  if (!sanitizedPath) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const DEFAULT_BASE_ID = process.env.AIRTABLE_BASE_ID;

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ 
      error: 'Server configuration error: AIRTABLE_API_KEY environment variable is not set. Please configure it in Vercel environment variables.' 
    });
  }

  try {
    // Parse and validate path
    const pathParts = sanitizedPath.split('/').filter(Boolean);
    let baseId, tablePath;
    
    // Check if first part is a base ID
    if (pathParts[0]?.startsWith('app') && pathParts.length > 1) {
      baseId = pathParts[0];
      tablePath = pathParts.slice(1).join('/');
    } else {
      if (!DEFAULT_BASE_ID) {
        return res.status(500).json({ 
          error: 'Server configuration error: AIRTABLE_BASE_ID environment variable is not set. Please configure it in Vercel environment variables.' 
        });
      }
      baseId = DEFAULT_BASE_ID;
      tablePath = sanitizedPath;
    }

    // Validate base ID
    if (!validateBaseId(baseId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Extract and validate table name
    const tablePart = tablePath.split('/')[0];
    if (!validateTableName(tablePart)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow GET, PATCH, and POST methods
    if (method !== 'GET' && method !== 'PATCH' && method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // For POST (create), path should be just the table name
    if (method === 'POST' && tablePath.split('/').length > 1) {
      return res.status(400).json({ error: 'Invalid path for POST request' });
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
    return res.status(500).json({ 
      error: error.message || 'Proxy error',
      details: process.env.VERCEL ? 'Check Vercel function logs for more details' : error.stack
    });
  }
  } catch (outerError) {
    console.error('Handler error:', outerError);
    return res.status(500).json({ 
      error: outerError.message || 'Internal server error',
      details: process.env.VERCEL ? 'Check Vercel function logs for more details' : outerError.stack
    });
  }
}
