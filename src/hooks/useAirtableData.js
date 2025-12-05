import {useEffect, useState} from 'react';
import airtableApi from '../services/airtableApi.js';

export function useAirtableData(tableName, promoterRecord, promoterRecordId, fieldMappings) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let isActive = true;

        async function run() {
            // Show loading while waiting for promoter record
            if (!tableName || !promoterRecord) {
                setLoading(true);
                setRecords([]);
                return;
            }

            setLoading(true);
            setError('');
            try {
                // Get event IDs from the Promoter's "Events" field
                const promoterEventsField = import.meta.env.VITE_PROMOTER_EVENTS_FIELD || 'Events';
                let eventIds = null;
                
                console.log('[Events] Promoter record:', { 
                    promoterRecord: promoterRecord?.id, 
                    promoterRecordId,
                    hasFields: !!promoterRecord?.fields,
                    eventsField: promoterEventsField
                });
                
                // First try SOURCE promoter (already fetched with raw values)
                if (promoterRecord) {
                    eventIds = promoterRecord?.fields?.[promoterEventsField];
                    console.log('[Events] Event IDs from SOURCE promoter:', eventIds);
                }
                
                // If not found in SOURCE, try TARGET promoter (in the main base with Events table)
                if ((!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) && promoterRecordId) {
                    const promotersTable = import.meta.env.VITE_PROMOTERS_TABLE_ID || import.meta.env.VITE_PROMOTERS_TABLE_NAME || 'Promoters';
                    try {
                        const targetPromoter = await airtableApi.getRecord(promotersTable, promoterRecordId, { noQuery: true });
                        eventIds = targetPromoter?.fields?.[promoterEventsField];
                        console.log('[Events] Event IDs from TARGET promoter:', eventIds);
                    } catch (err) {
                        console.warn('Failed to fetch TARGET promoter for Events field:', err);
                    }
                }
                
                if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
                    console.log('[Events] No event IDs found in promoter');
                    if (!isActive) return;
                    setRecords([]);
                    setLoading(false);
                    return;
                }

                // Filter out any non-string values (in case there are formatted objects)
                const validEventIds = eventIds.filter(id => typeof id === 'string' && id.length > 0);
                console.log('[Events] Valid event IDs:', validEventIds);
                
                if (validEventIds.length === 0) {
                    console.log('[Events] No valid event IDs after filtering');
                    if (!isActive) return;
                    setRecords([]);
                    setLoading(false);
                    return;
                }

                // Fetch events by their IDs using filter formula
                // Using filter formula with OR conditions for multiple IDs
                const filterFormula = `OR(${validEventIds.map(id => `RECORD_ID() = "${id}"`).join(', ')})`;
                console.log('[Events] Filter formula:', filterFormula);
                console.log('[Events] Table name:', tableName);
                
                const data = await airtableApi.getRecords(tableName, {
                    filterByFormula: filterFormula,
                    sort: { field: fieldMappings.startDateField, direction: 'asc' },
                    cellFormat: 'string',
                    timeZone: 'Europe/Zurich',
                    userLocale: 'en-GB'
                });
                
                console.log('[Events] API response:', {
                    totalRecords: data?.records?.length,
                    recordIds: data?.records?.map(r => r.id),
                    allRecords: data?.records
                });
                
                if (!isActive) return;
                const finalRecords = Array.isArray(data.records) ? data.records : [];
                console.log('[Events] Final records count:', finalRecords.length);
                console.log('[Events] All event records:', finalRecords);
                setRecords(finalRecords);
            } catch (e) {
                if (!isActive) return;
                console.error('Failed to load events:', e);
                setError(e?.message || 'Failed to load records');
            } finally {
                if (isActive) setLoading(false);
            }
        }

        run();
        return () => { isActive = false; };
    }, [
        tableName,
        promoterRecord,
        promoterRecordId,
        fieldMappings?.startDateField
    ]);

    return {records, loading, error};
}


