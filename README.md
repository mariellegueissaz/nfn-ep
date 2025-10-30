# Self-hosted Events Portal

This app mirrors your Airtable Interface Extension, but runs outside Airtable using the Airtable REST API and Firebase Authentication.

## Environment variables
Create a `.env` file in this directory with the following keys:

- VITE_AIRTABLE_API_KEY
- VITE_AIRTABLE_BASE_ID
- VITE_TABLE_NAME (default: Events)
- VITE_FIELD_PROMOTER_EMAIL (default: Signee Party Email (from Contract party 2))
- VITE_FIELD_START (default: Doors open)
- VITE_FIELD_END (default: End)
- VITE_FIELD_EVENT_NAME (default: Eventname)
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID

## Install & Run
1. `cd selfhosted`
2. `npm install --legacy-peer-deps`
3. `npm run dev`

## Build
- `npm run build`
- `npm run preview` (optional)

## Deploy
- Deploy `selfhosted` with env vars set; build command `npm run build`; output dir `selfhosted/dist`.
