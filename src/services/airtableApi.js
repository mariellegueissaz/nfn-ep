const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

const getEnv = (key, fallback = '') => {
    // Vite exposes env as import.meta.env
    return import.meta.env[key] ?? fallback;
};

const AIRTABLE_BASE_ID = getEnv('VITE_AIRTABLE_BASE_ID');
const AIRTABLE_API_KEY = getEnv('VITE_AIRTABLE_API_KEY');

class AirtableApiService {
    constructor() {
        this.headers = {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        };
    }

    async getRecords(tableName, options = {}) {
        const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;
        const params = new URLSearchParams();

        if (Array.isArray(options.fields) && options.fields.length > 0) {
            for (const f of options.fields) params.append('fields[]', f);
        }
        if (options.filterByFormula) {
            params.append('filterByFormula', options.filterByFormula);
        }
        if (options.sort && options.sort.field) {
            params.append('sort[0][field]', options.sort.field);
            params.append('sort[0][direction]', options.sort.direction || 'asc');
        }
        if (options.returnFieldsByFieldId) {
            params.append('returnFieldsByFieldId', 'true');
        }
        // Ensure values like linked records are returned as human-readable strings.
        // Airtable requires timeZone and userLocale when cellFormat=string.
        const cellFormat = options.cellFormat || 'string';
        params.append('cellFormat', cellFormat);
        if (cellFormat === 'string') {
            const timeZone = options.timeZone || getEnv('VITE_AIRTABLE_TIMEZONE', 'UTC');
            const userLocale = options.userLocale || getEnv('VITE_AIRTABLE_LOCALE', 'en-GB');
            params.append('timeZone', timeZone);
            params.append('userLocale', userLocale);
        }

        const response = await fetch(`${url}?${params.toString()}`, {
            headers: this.headers
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Airtable API error ${response.status}: ${text}`);
        }

        return response.json();
    }

    async getRecord(tableName, recordId, options = {}) {
        const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;
        if (options && options.noQuery) {
            const response = await fetch(url, { headers: this.headers });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Airtable API error ${response.status}: ${text}`);
            }
            return response.json();
        }
        const params = new URLSearchParams();
        if (Array.isArray(options.fields) && options.fields.length > 0) {
            for (const f of options.fields) params.append('fields[]', f);
        }
        if (options.cellFormat) {
            params.append('cellFormat', options.cellFormat);
            if (options.cellFormat === 'string') {
                const timeZone = options.timeZone || getEnv('VITE_AIRTABLE_TIMEZONE', 'UTC');
                const userLocale = options.userLocale || getEnv('VITE_AIRTABLE_LOCALE', 'en-GB');
                params.append('timeZone', timeZone);
                params.append('userLocale', userLocale);
            }
        }
        const qs = params.toString();
        const response = await fetch(qs ? `${url}?${qs}` : url, {
            headers: this.headers
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Airtable API error ${response.status}: ${text}`);
        }
        return response.json();
    }

    async getRecordInBase(baseId, tableNameOrId, recordId, options = {}) {
        const url = `${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(tableNameOrId)}/${recordId}`;
        if (options && options.noQuery) {
            const response = await fetch(url, { headers: this.headers });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Airtable API error ${response.status}: ${text}`);
            }
            return response.json();
        }
        const params = new URLSearchParams();
        if (Array.isArray(options.fields) && options.fields.length > 0) {
            for (const f of options.fields) params.append('fields[]', f);
        }
        if (options.cellFormat) {
            params.append('cellFormat', options.cellFormat);
            if (options.cellFormat === 'string') {
                const timeZone = options.timeZone || getEnv('VITE_AIRTABLE_TIMEZONE', 'UTC');
                const userLocale = options.userLocale || getEnv('VITE_AIRTABLE_LOCALE', 'en-GB');
                params.append('timeZone', timeZone);
                params.append('userLocale', userLocale);
            }
        }
        const qs = params.toString();
        const response = await fetch(qs ? `${url}?${qs}` : url, {
            headers: this.headers
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Airtable API error ${response.status}: ${text}`);
        }
        return response.json();
    }

    async updateRecord(tableName, recordId, fields) {
        const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;
        const response = await fetch(url, {
            method: 'PATCH',
            headers: this.headers,
            body: JSON.stringify({ fields })
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Airtable API error ${response.status}: ${text}`);
        }
        return response.json();
    }

    async updateRecordInBase(baseId, tableNameOrId, recordId, fields) {
        const url = `${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(tableNameOrId)}/${recordId}`;
        const response = await fetch(url, {
            method: 'PATCH',
            headers: this.headers,
            body: JSON.stringify({ fields })
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Airtable API error ${response.status}: ${text}`);
        }
        return response.json();
    }
}

export default new AirtableApiService();


