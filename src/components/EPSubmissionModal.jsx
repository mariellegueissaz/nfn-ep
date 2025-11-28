import React, { useState } from 'react';
import airtableApi from '../services/airtableApi.js';

export default function EPSubmissionModal({ open, onClose, event, fieldMappings, onSuccess }) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [values, setValues] = useState({});

    React.useEffect(() => {
        if (!open || !event) return;
        
        async function loadEventWithRawValues() {
            try {
                // Load event with raw values to get location record IDs
                const tableName = import.meta.env.VITE_TABLE_NAME || import.meta.env.VITE_TABLE_ID;
                const rawEvent = await airtableApi.getRecord(tableName, event.id, { noQuery: true });
                
                const eventFields = rawEvent.fields || {};
                const locationValue = eventFields[fieldMappings.locationField];
                
                // Extract location record IDs
                let locationIds = [];
                if (Array.isArray(locationValue)) {
                    locationIds = locationValue.filter(Boolean);
                } else if (locationValue) {
                    locationIds = [locationValue];
                }

                setValues({
                    // EP Submission field -> Event field mapping
                    'Eventname': eventFields[fieldMappings.eventNameField] || '',
                    'Doors open': eventFields[fieldMappings.startDateField] || '',
                    'End': eventFields[fieldMappings.endDateField] || '',
                    'Location': locationIds.length > 0 ? locationIds : null,
                    'Proposed timetable': eventFields[fieldMappings.proposedLineupField] || '',
                    'Announcement date': eventFields[fieldMappings.proposedAnnouncementDateField] || ''
                });
                setError('');
            } catch (err) {
                console.error('Failed to load event with raw values:', err);
                // Fallback to using formatted values
                const eventFields = event.fields || {};
                setValues({
                    'Eventname': eventFields[fieldMappings.eventNameField] || '',
                    'Doors open': eventFields[fieldMappings.startDateField] || '',
                    'End': eventFields[fieldMappings.endDateField] || '',
                    'Location': null, // Can't extract IDs from formatted values
                    'Proposed timetable': eventFields[fieldMappings.proposedLineupField] || '',
                    'Announcement date': eventFields[fieldMappings.proposedAnnouncementDateField] || ''
                });
            }
        }
        
        loadEventWithRawValues();
    }, [open, event, fieldMappings]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            const epSubmissionTable = import.meta.env.VITE_EP_SUBMISSION_TABLE_NAME || import.meta.env.VITE_EP_SUBMISSION_TABLE_ID || 'EP Submissions';
            const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
            
            // Prepare fields for creation
            const fields = {};
            for (const [key, value] of Object.entries(values)) {
                if (value !== null && value !== undefined && value !== '') {
                    fields[key] = value;
                }
            }

            // Create EP Submission record
            const newRecord = await airtableApi.createRecordInBase(baseId, epSubmissionTable, fields);
            
            // Link the EP Submission to the Event
            const eventsTable = import.meta.env.VITE_TABLE_NAME || import.meta.env.VITE_TABLE_ID;
            const epSubmissionLinkField = import.meta.env.VITE_EP_SUBMISSION_LINK_FIELD || 'EP Submission';
            
            // Get current EP Submission links from event
            const currentEvent = await airtableApi.getRecord(eventsTable, event.id, { noQuery: true });
            const currentLinks = currentEvent?.fields?.[epSubmissionLinkField] || [];
            const updatedLinks = Array.isArray(currentLinks) ? [...currentLinks, newRecord.id] : [newRecord.id];
            
            // Update event with new EP Submission link
            await airtableApi.updateRecord(eventsTable, event.id, {
                [epSubmissionLinkField]: updatedLinks
            });

            if (onSuccess) {
                onSuccess(newRecord);
            }
            onClose();
        } catch (err) {
            console.error('Failed to create EP Submission:', err);
            setError(err?.message || 'Failed to create EP Submission');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-gray700 rounded-lg shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-gray800 dark:text-gray-gray100">Create EP Submission</h2>
                    <button onClick={onClose} className="text-gray-gray500 hover:text-gray-gray700 dark:text-gray-gray300 dark:hover:text-gray-gray100">✕</button>
                </div>
                
                {error && (
                    <div className="mb-4 p-3 bg-red-red bg-opacity-10 border border-red-red rounded text-red-red text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Eventname</label>
                            <input
                                type="text"
                                value={values['Eventname'] || ''}
                                onChange={(e) => setValues(prev => ({...prev, 'Eventname': e.target.value}))}
                                className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Doors open</label>
                            <input
                                type="datetime-local"
                                value={values['Doors open'] ? (() => {
                                    try {
                                        const date = new Date(values['Doors open']);
                                        if (isNaN(date.getTime())) return '';
                                        // Adjust for timezone offset
                                        const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                                        return localDate.toISOString().slice(0, 16);
                                    } catch {
                                        return '';
                                    }
                                })() : ''}
                                onChange={(e) => setValues(prev => ({...prev, 'Doors open': e.target.value ? new Date(e.target.value).toISOString() : ''}))}
                                className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100"
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">End</label>
                            <input
                                type="datetime-local"
                                value={values['End'] ? (() => {
                                    try {
                                        const date = new Date(values['End']);
                                        if (isNaN(date.getTime())) return '';
                                        const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                                        return localDate.toISOString().slice(0, 16);
                                    } catch {
                                        return '';
                                    }
                                })() : ''}
                                onChange={(e) => setValues(prev => ({...prev, 'End': e.target.value ? new Date(e.target.value).toISOString() : ''}))}
                                className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100"
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Announcement date</label>
                            <input
                                type="date"
                                value={values['Announcement date'] ? (() => {
                                    try {
                                        const date = new Date(values['Announcement date']);
                                        if (isNaN(date.getTime())) return '';
                                        return date.toISOString().split('T')[0];
                                    } catch {
                                        return '';
                                    }
                                })() : ''}
                                onChange={(e) => setValues(prev => ({...prev, 'Announcement date': e.target.value || ''}))}
                                className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Location</label>
                            <input
                                type="text"
                                value={Array.isArray(values['Location']) ? values['Location'].join(', ') : (values['Location'] || '')}
                                disabled
                                className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-gray-gray50 dark:bg-gray-gray800 text-gray-gray600 dark:text-gray-gray400 cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-gray500 dark:text-gray-gray400 mt-1">Location is automatically linked from the event</p>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Proposed timetable</label>
                            <textarea
                                value={values['Proposed timetable'] || ''}
                                onChange={(e) => setValues(prev => ({...prev, 'Proposed timetable': e.target.value}))}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100"
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray800 dark:text-gray-gray100 rounded-md hover:bg-gray-gray300 dark:hover:bg-gray-gray500"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-blue-blue text-white rounded-md hover:bg-opacity-90 disabled:opacity-60"
                        >
                            {saving ? 'Creating...' : 'Create EP Submission'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

