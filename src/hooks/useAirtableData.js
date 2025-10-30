import {useEffect, useState} from 'react';
import airtableApi from '../services/airtableApi.js';

export function useAirtableData(tableName, userEmail, fieldMappings) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let isActive = true;

        async function run() {
            if (!tableName || !userEmail || !fieldMappings?.promoterEmailField) {
                setRecords([]);
                return;
            }

            setLoading(true);
            setError('');
            try {
                const filterFormula = `{${fieldMappings.promoterEmailField}} = "${userEmail}"`;
                const data = await airtableApi.getRecords(tableName, {
                    filterByFormula: filterFormula,
                    sort: { field: fieldMappings.startDateField, direction: 'asc' }
                });
                if (!isActive) return;
                setRecords(Array.isArray(data.records) ? data.records : []);
            } catch (e) {
                if (!isActive) return;
                setError(e?.message || 'Failed to load records');
            } finally {
                if (isActive) setLoading(false);
            }
        }

        run();
        return () => { isActive = false; };
    }, [
        tableName,
        userEmail,
        fieldMappings?.promoterEmailField,
        fieldMappings?.startDateField
    ]);

    return {records, loading, error};
}


