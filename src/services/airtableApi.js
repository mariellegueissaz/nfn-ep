const PROXY_URL = '/api/airtable-proxy';

const getEnv = (key, fallback = '') => {
    // Vite exposes env as import.meta.env
    return import.meta.env[key] ?? fallback;
};

const AIRTABLE_BASE_ID = getEnv('VITE_AIRTABLE_BASE_ID');

class AirtableApiService {
    async callProxy(path, method = 'GET', body = null, queryParams = {}) {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, method, body, queryParams })
        });
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText };
            }
            throw new Error(`Airtable API error ${response.status}: ${JSON.stringify(errorData)}`);
        }
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            throw new Error(`Invalid JSON response: ${text}`);
        }
    }

    async getRecords(tableName, options = {}) {
        const path = `${encodeURIComponent(tableName)}`;
        const params = {};

        if (Array.isArray(options.fields) && options.fields.length > 0) {
            params['fields[]'] = options.fields;
        }
        if (options.filterByFormula) {
            params.filterByFormula = options.filterByFormula;
        }
        if (options.sort && options.sort.field) {
            params['sort[0][field]'] = options.sort.field;
            params['sort[0][direction]'] = options.sort.direction || 'asc';
        }
        if (options.returnFieldsByFieldId) {
            params.returnFieldsByFieldId = 'true';
        }
        const cellFormat = options.cellFormat || 'string';
        params.cellFormat = cellFormat;
        if (cellFormat === 'string') {
            params.timeZone = options.timeZone || getEnv('VITE_AIRTABLE_TIMEZONE', 'UTC');
            params.userLocale = options.userLocale || getEnv('VITE_AIRTABLE_LOCALE', 'en-GB');
        }

        return this.callProxy(path, 'GET', null, params);
    }

    async getRecord(tableName, recordId, options = {}) {
        const path = `${encodeURIComponent(tableName)}/${recordId}`;
        const params = {};

        if (!options.noQuery) {
            if (Array.isArray(options.fields) && options.fields.length > 0) {
                params['fields[]'] = options.fields;
            }
            if (options.cellFormat) {
                params.cellFormat = options.cellFormat;
                if (options.cellFormat === 'string') {
                    params.timeZone = options.timeZone || getEnv('VITE_AIRTABLE_TIMEZONE', 'UTC');
                    params.userLocale = options.userLocale || getEnv('VITE_AIRTABLE_LOCALE', 'en-GB');
                }
            }
        }

        return this.callProxy(path, 'GET', null, params);
    }

    async getRecordInBase(baseId, tableNameOrId, recordId, options = {}) {
        const path = `${encodeURIComponent(tableNameOrId)}/${recordId}`;
        const params = {};

        if (!options.noQuery) {
            if (Array.isArray(options.fields) && options.fields.length > 0) {
                for (const f of options.fields) params['fields[]'] = (params['fields[]'] || []).concat(f);
            }
            if (options.cellFormat) {
                params.cellFormat = options.cellFormat;
                if (options.cellFormat === 'string') {
                    params.timeZone = options.timeZone || getEnv('VITE_AIRTABLE_TIMEZONE', 'UTC');
                    params.userLocale = options.userLocale || getEnv('VITE_AIRTABLE_LOCALE', 'en-GB');
                }
            }
        }

        const fullPath = `${baseId}/${path}`;
        return this.callProxy(fullPath, 'GET', null, params);
    }

    async updateRecord(tableName, recordId, fields) {
        const path = `${encodeURIComponent(tableName)}/${recordId}`;
        return this.callProxy(path, 'PATCH', { fields });
    }

    async updateRecordInBase(baseId, tableNameOrId, recordId, fields) {
        const path = `${baseId}/${encodeURIComponent(tableNameOrId)}/${recordId}`;
        return this.callProxy(path, 'PATCH', { fields });
    }
}

export default new AirtableApiService();


