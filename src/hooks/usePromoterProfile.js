import {useCallback, useEffect, useMemo, useState} from 'react';
import airtableApi from '../services/airtableApi.js';

export function usePromoterProfile(userEmail, mappings) {
    const [promoterRecord, setPromoterRecord] = useState(null);
    const [promoterRecordId, setPromoterRecordId] = useState('');
    const [sourcePromoterRecordId, setSourcePromoterRecordId] = useState('');
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const crmTable = useMemo(() => (import.meta.env.VITE_CRM_TABLE_ID || import.meta.env.VITE_CRM_TABLE_NAME || 'CRM'), []);
    const promotersTable = useMemo(() => (import.meta.env.VITE_PROMOTERS_TABLE_ID || import.meta.env.VITE_PROMOTERS_TABLE_NAME || 'Promoters'), []);
    const crmEmailField = mappings.crmEmailField;
    const crmPromotersLinkField = mappings.crmPromotersLinkField;
    const sourceBaseId = useMemo(() => import.meta.env.VITE_SOURCE_BASE_ID, []);
    const sourcePromotersTable = useMemo(() => (import.meta.env.VITE_SOURCE_PROMOTERS_TABLE_ID || import.meta.env.VITE_SOURCE_PROMOTERS_TABLE_NAME), []);
    const promoterRecordIdField = useMemo(() => (import.meta.env.VITE_PROMOTER_RECORD_ID_FIELD || 'Record ID from CRM'), []);
    const sourceContactsLinkField = mappings.sourceContactsLinkField;
    const sourceCrmTable = mappings.sourceCrmTable;

    useEffect(() => {
        let isActive = true;
        async function load() {
            if (!userEmail) { setPromoterRecord(null); setPromoterRecordId(''); return; }
            setLoading(true);
            setError('');
            try {
                // Step 1: find CRM record by email and get linked promoter IDs (json cellFormat)
                const crmResp = await airtableApi.getRecords(crmTable, {
                    filterByFormula: `{${crmEmailField}} = "${userEmail}"`,
                    fields: [crmPromotersLinkField],
                    cellFormat: 'json'
                });
                const first = Array.isArray(crmResp.records) ? crmResp.records[0] : null;
                const linkedIds = first?.fields?.[crmPromotersLinkField];
                const count = Array.isArray(linkedIds) ? linkedIds.length : 0;
                if (count !== 1) {
                    if (isActive) {
                        setPromoterRecord(null);
                        setPromoterRecordId('');
                        setError(count === 0 ? 'No promoter linked to your CRM profile.' : 'Multiple promoters linked to your CRM profile. Please contact support.');
                    }
                    setLoading(false);
                    return;
                }
                const promoterId = linkedIds[0];
                if (!isActive) return;
                setPromoterRecordId(promoterId);

                // Step 2: fetch TARGET promoter to read the source record id
                const targetPromoter = await airtableApi.getRecord(promotersTable, promoterId, { noQuery: true });
                const sourceRecordId = targetPromoter?.fields?.[promoterRecordIdField];
                if (!sourceRecordId || !sourceBaseId || !sourcePromotersTable) {
                    if (isActive) setError('Missing source configuration or source record id');
                    setLoading(false);
                    return;
                }
                if (isActive) setSourcePromoterRecordId(sourceRecordId);

                // Step 3: fetch SOURCE promoter record for display/edit
                // Fetch without query params so linked record field returns record IDs (not display names)
                const sourcePromoter = await airtableApi.getRecordInBase(sourceBaseId, sourcePromotersTable, sourceRecordId, { noQuery: true });
                if (!isActive) return;
                setPromoterRecord(sourcePromoter);

                // Load contacts linked to this promoter
                const contactIds = sourcePromoter?.fields?.[sourceContactsLinkField];
                console.log('[Contacts] Link field and IDs:', { linkField: sourceContactsLinkField, contactIds });
                if (Array.isArray(contactIds) && contactIds.length > 0) {
                    const loaded = [];
                    for (const cid of contactIds) {
                        try {
                            console.log('[Contacts] Fetching contact from SOURCE CRM:', { sourceBaseId, sourceCrmTable, cid });
                            const c = await airtableApi.getRecordInBase(sourceBaseId, sourceCrmTable, cid, { cellFormat: 'string' });
                            console.log('[Contacts] Loaded contact:', { id: c?.id, name: c?.fields?.[mappings?.contactFirstNameField] });
                            loaded.push(c);
                        } catch (e) {
                            console.warn('[Contacts] Failed to load contact', { cid, error: e?.message });
                        }
                    }
                    if (isActive) setContacts(loaded);
                } else {
                    console.log('[Contacts] No contacts linked to promoter');
                    if (isActive) setContacts([]);
                }
            } catch (e) {
                if (!isActive) return;
                setError(e?.message || 'Failed to load promoter');
            } finally {
                if (isActive) setLoading(false);
            }
        }
        load();
        return () => { isActive = false; };
    }, [userEmail, crmTable, crmEmailField, crmPromotersLinkField, promotersTable, mappings?.companyNameField]);

    const save = useCallback(async (fields, sourceFields) => {
        if (!promoterRecordId) throw new Error('Missing promoter record id');
        if (!sourcePromoterRecordId) {
            console.error('[Profile:Save] Missing sourcePromoterRecordId');
            throw new Error('Missing SOURCE promoter record id');
        }
        try {
            const sourceBaseId = import.meta.env.VITE_SOURCE_BASE_ID;
            const sourcePromotersTable = import.meta.env.VITE_SOURCE_PROMOTERS_TABLE_ID || import.meta.env.VITE_SOURCE_PROMOTERS_TABLE_NAME;
            const sourceRecordId = sourcePromoterRecordId;

            if (sourceBaseId && sourcePromotersTable && sourceRecordId) {
                console.log('[Profile:Save] Updating SOURCE record', {
                    sourceBaseId,
                    sourcePromotersTable,
                    sourceRecordId,
                    payload: sourceFields || fields
                });
                await airtableApi.updateRecordInBase(sourceBaseId, sourcePromotersTable, sourceRecordId, sourceFields || fields);
            } else {
                console.log('[Profile:Save] Using SOURCE identifiers for update', {
                    sourceBaseId,
                    sourcePromotersTable,
                    sourceRecordId,
                    payload: sourceFields || fields
                });
                await airtableApi.updateRecordInBase(sourceBaseId, sourcePromotersTable, sourceRecordId, sourceFields || fields);
            }
            // Re-fetch as string-formatted for consistent display
            const refreshed = await airtableApi.getRecord(
                import.meta.env.VITE_PROMOTERS_TABLE_ID || import.meta.env.VITE_PROMOTERS_TABLE_NAME || 'Promoters',
                promoterRecordId,
                { cellFormat: 'string' }
            );
            setPromoterRecord(refreshed);
            return refreshed;
        } catch (e) {
            // Surface more info to caller
            throw e;
        }
    }, [promoterRecordId, sourcePromoterRecordId, sourceBaseId, sourcePromotersTable]);

    const reload = useCallback(async () => {
        if (!sourceBaseId || !sourcePromotersTable || !sourcePromoterRecordId) return;
        const latest = await airtableApi.getRecordInBase(sourceBaseId, sourcePromotersTable, sourcePromoterRecordId, { noQuery: true });
        setPromoterRecord(latest);
        const contactIds = latest?.fields?.[sourceContactsLinkField];
        console.log('[Contacts:Reload] IDs:', contactIds);
        if (Array.isArray(contactIds) && contactIds.length > 0) {
            const loaded = [];
            for (const cid of contactIds) {
                try {
                    console.log('[Contacts:Reload] Fetch', cid);
                    const c = await airtableApi.getRecordInBase(sourceBaseId, sourceCrmTable, cid, { cellFormat: 'string' });
                    loaded.push(c);
                } catch (e) {}
            }
            setContacts(loaded);
        } else {
            console.log('[Contacts:Reload] No contacts');
            setContacts([]);
        }
    }, [sourceBaseId, sourcePromotersTable, sourcePromoterRecordId]);

    const saveContact = useCallback(async (contactRecordId, fields) => {
        await airtableApi.updateRecordInBase(sourceBaseId, sourceCrmTable, contactRecordId, fields);
        // refresh this contact locally
        const updated = await airtableApi.getRecordInBase(sourceBaseId, sourceCrmTable, contactRecordId, { cellFormat: 'string' });
        setContacts(prev => prev.map(c => c.id === contactRecordId ? updated : c));
        return updated;
    }, [sourceBaseId, sourceCrmTable]);

    const createContact = useCallback(async (fields) => {
        // Create new CRM record
        const newRecord = await airtableApi.createRecordInBase(sourceBaseId, sourceCrmTable, fields);
        const newContactId = newRecord.id;

        // Link to promoter: get current linked contacts and add new one
        const currentPromoter = await airtableApi.getRecordInBase(sourceBaseId, sourcePromotersTable, sourcePromoterRecordId, { noQuery: true });
        const currentLinks = currentPromoter?.fields?.[sourceContactsLinkField] || [];
        const updatedLinks = Array.isArray(currentLinks) ? [...currentLinks, newContactId] : [newContactId];

        // Update promoter with new link
        await airtableApi.updateRecordInBase(sourceBaseId, sourcePromotersTable, sourcePromoterRecordId, {
            [sourceContactsLinkField]: updatedLinks
        });

        // Reload contacts to include the new one
        await reload();
        return newRecord;
    }, [sourceBaseId, sourceCrmTable, sourcePromotersTable, sourcePromoterRecordId, sourceContactsLinkField, reload]);

    const unlinkContact = useCallback(async (contactRecordId) => {
        // Get current linked contacts
        const currentPromoter = await airtableApi.getRecordInBase(sourceBaseId, sourcePromotersTable, sourcePromoterRecordId, { noQuery: true });
        const currentLinks = currentPromoter?.fields?.[sourceContactsLinkField] || [];
        
        // Remove the contact ID from the array
        const updatedLinks = Array.isArray(currentLinks) 
            ? currentLinks.filter(id => id !== contactRecordId)
            : [];

        // Update promoter to unlink
        await airtableApi.updateRecordInBase(sourceBaseId, sourcePromotersTable, sourcePromoterRecordId, {
            [sourceContactsLinkField]: updatedLinks
        });

        // Reload contacts
        await reload();
    }, [sourceBaseId, sourcePromotersTable, sourcePromoterRecordId, sourceContactsLinkField, reload]);

    return {promoterRecord, promoterRecordId, contacts, loading, error, save, saveContact, createContact, unlinkContact, reload};
}


