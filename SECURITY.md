# Security Configuration

This app implements multiple security layers to protect your Airtable data.

## Security Features

1. **Server-side API Key** - Airtable API key never exposed to browser
2. **Firebase Authentication** - All API requests require valid Firebase token
3. **Whitelist-based Access Control** - Only approved bases and tables can be accessed
4. **Input Validation** - All paths and table names are validated and sanitized
5. **Rate Limiting** - Prevents abuse (30 requests/minute per IP)
6. **Path Traversal Protection** - Blocks attempts to access unauthorized paths

## Required Environment Variables

### Server-side (Vercel Environment Variables - NOT VITE_)

Add these in Vercel → Project Settings → Environment Variables:

```
AIRTABLE_API_KEY=your_airtable_personal_access_token
AIRTABLE_BASE_ID=appN405Xb7SR80BaK
ALLOWED_BASES=appN405Xb7SR80BaK,appurmvlOBACIWxYK
ALLOWED_TABLES=tblkiVgph5gj96o6K,tblzLojap9LTiDMTI,tblE56tu6t8YpgUPx,tblNphtP9HtUq1wV3
ALLOWED_ORIGIN=https://your-domain.vercel.app
```

### Optional: Firebase Admin (for production token verification)

For production, set up Firebase Admin SDK for proper token verification:

1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate a new private key
3. Add to Vercel as `FIREBASE_SERVICE_ACCOUNT` (paste the entire JSON)

**Note:** If not set, the proxy will allow requests in dev mode but should be configured for production.

## Whitelist Configuration

### ALLOWED_BASES
Comma-separated list of Airtable base IDs that can be accessed.
- Example: `appN405Xb7SR80BaK,appurmvlOBACIWxYK`
- If empty, all bases matching the pattern are allowed (less secure)

### ALLOWED_TABLES
Comma-separated list of table IDs or names that can be accessed.
- Example: `tblkiVgph5gj96o6K,Events,Promoters,CRM`
- If empty, all tables matching the pattern are allowed (less secure)

**Security Recommendation:** Always set both `ALLOWED_BASES` and `ALLOWED_TABLES` to restrict access to only the tables your app needs.

## Testing Security

1. **Try accessing unauthorized table:**
   - Should return 403 "Access denied"

2. **Try without Firebase token:**
   - Should return 401 "Unauthorized"

3. **Try with invalid path:**
   - Should return 400 "Invalid path"

4. **Try rate limiting:**
   - Make 30+ requests quickly
   - Should return 429 "Too many requests"

## Production Checklist

- [ ] `AIRTABLE_API_KEY` set in Vercel (server-side only)
- [ ] `ALLOWED_BASES` configured with exact base IDs
- [ ] `ALLOWED_TABLES` configured with exact table IDs/names
- [ ] `ALLOWED_ORIGIN` set to your production domain
- [ ] `FIREBASE_SERVICE_ACCOUNT` configured for token verification
- [ ] All `VITE_*` variables set (these are safe to be public)
- [ ] Test that unauthorized access attempts are blocked

