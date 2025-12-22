import React, { useState } from 'react';
import airtableApi from '../services/airtableApi.js';
import { parseDate } from '../utils/dateUtils.js';

export default function EPSubmissionModal({ open, onClose, event, fieldMappings, onSuccess }) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [values, setValues] = useState({});
    const [locations, setLocations] = useState([]);
    const [loadingLocations, setLoadingLocations] = useState(false);
    const [showLocationSelector, setShowLocationSelector] = useState(false);

    // Fetch all locations when modal opens
    React.useEffect(() => {
        if (!open) return;
        
        async function fetchLocations() {
            try {
                setLoadingLocations(true);
                const locationsTable = import.meta.env.VITE_LOCATIONS_TABLE_NAME || import.meta.env.VITE_LOCATIONS_TABLE_ID || 'Locations';
                const data = await airtableApi.getRecords(locationsTable, {
                    cellFormat: 'string',
                    timeZone: 'Europe/Zurich',
                    userLocale: 'en-GB'
                });
                
                // Extract location records with id and name
                const locationRecords = (data?.records || []).map(record => ({
                    id: record.id,
                    name: record.fields?.Location_ID || 'Unnamed Location'
                }));
                setLocations(locationRecords);
            } catch (err) {
                console.error('Failed to load locations:', err);
                setLocations([]);
            } finally {
                setLoadingLocations(false);
            }
        }
        
        fetchLocations();
    }, [open]);

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

                // Calculate production load times from event record
                const doorsOpenStr = eventFields[fieldMappings.startDateField];
                const endStr = eventFields[fieldMappings.endDateField];
                const doorsOpen = doorsOpenStr ? parseDate(doorsOpenStr) : null;
                const end = endStr ? parseDate(endStr) : null;

                let loadInStart = '';
                let loadInEnd = '';
                let loadOutStart = '';
                let loadOutEnd = '';

                if (doorsOpen) {
                    // Load In Start: Doors open - 4 hours
                    const loadInStartDate = new Date(doorsOpen.getTime() - 4 * 60 * 60 * 1000);
                    loadInStart = loadInStartDate.toISOString();
                    // Load In End: Doors open - 2 hours
                    const loadInEndDate = new Date(doorsOpen.getTime() - 2 * 60 * 60 * 1000);
                    loadInEnd = loadInEndDate.toISOString();
                }

                if (end) {
                    // Load Out Start: End + 0.5 hour
                    const loadOutStartDate = new Date(end.getTime() + 0.5 * 60 * 60 * 1000);
                    loadOutStart = loadOutStartDate.toISOString();
                    // Load Out End: End + 1.5 hours
                    const loadOutEndDate = new Date(end.getTime() + 1.5 * 60 * 60 * 1000);
                    loadOutEnd = loadOutEndDate.toISOString();
                }

                // Get announcement date - try both the mapped field and direct field name
                const announcementDateField = fieldMappings.proposedAnnouncementDateField || 'Announcement date';
                const announcementDate = eventFields[announcementDateField] || eventFields['Announcement date'] || '';

                setValues({
                    // EP Submission field -> Event field mapping
                    'Eventname': eventFields[fieldMappings.eventNameField] || '',
                    'Doors open': doorsOpenStr || '',
                    'End': endStr || '',
                    'Location': locationIds.length > 0 ? locationIds : null,
                    'Proposed timetable': eventFields[fieldMappings.proposedLineupField] || '',
                    'Announcement date': announcementDate,
                    'Tickets on sale': '',
                    'Load time necessary': '', // Default empty
                    'Proposed production load in start': loadInStart,
                    'Proposed production load in end': loadInEnd,
                    'Proposed production load out start': loadOutStart,
                    'Proposed production load out end': loadOutEnd,
                    'Comment': ''
                });
                setError('');
            } catch (err) {
                console.error('Failed to load event with raw values:', err);
                // Fallback to using formatted values
                const eventFields = event.fields || {};
                const doorsOpenStr = eventFields[fieldMappings.startDateField];
                const endStr = eventFields[fieldMappings.endDateField];
                const doorsOpen = doorsOpenStr ? parseDate(doorsOpenStr) : null;
                const end = endStr ? parseDate(endStr) : null;

                let loadInStart = '';
                let loadInEnd = '';
                let loadOutStart = '';
                let loadOutEnd = '';

                if (doorsOpen) {
                    const loadInStartDate = new Date(doorsOpen.getTime() - 4 * 60 * 60 * 1000);
                    loadInStart = loadInStartDate.toISOString();
                    const loadInEndDate = new Date(doorsOpen.getTime() - 2 * 60 * 60 * 1000);
                    loadInEnd = loadInEndDate.toISOString();
                }

                if (end) {
                    const loadOutStartDate = new Date(end.getTime() + 0.5 * 60 * 60 * 1000);
                    loadOutStart = loadOutStartDate.toISOString();
                    const loadOutEndDate = new Date(end.getTime() + 1.5 * 60 * 60 * 1000);
                    loadOutEnd = loadOutEndDate.toISOString();
                }

                // Get announcement date - try both the mapped field and direct field name
                const announcementDateField = fieldMappings.proposedAnnouncementDateField || 'Announcement date';
                const announcementDate = eventFields[announcementDateField] || eventFields['Announcement date'] || '';

                setValues({
                    'Eventname': eventFields[fieldMappings.eventNameField] || '',
                    'Doors open': doorsOpenStr || '',
                    'End': endStr || '',
                    'Location': null, // Can't extract IDs from formatted values
                    'Proposed timetable': eventFields[fieldMappings.proposedLineupField] || '',
                    'Announcement date': announcementDate,
                    'Tickets on sale': '',
                    'Load time necessary': '', // Default empty
                    'Proposed production load in start': loadInStart,
                    'Proposed production load in end': loadInEnd,
                    'Proposed production load out start': loadOutStart,
                    'Proposed production load out end': loadOutEnd,
                    'Comment': ''
                });
            }
        }
        
        loadEventWithRawValues();
    }, [open, event, fieldMappings]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        // Validate required fields
        if (!values['Eventname'] || values['Eventname'].trim() === '') {
            setError('Eventname is required');
            setSaving(false);
            return;
        }

        const locationIds = Array.isArray(values['Location']) ? values['Location'] : (values['Location'] ? [values['Location']] : []);
        if (!locationIds || locationIds.length === 0) {
            setError('Location is required');
            setSaving(false);
            return;
        }

        if (!values['Doors open']) {
            setError('Doors open is required');
            setSaving(false);
            return;
        }

        if (!values['End']) {
            setError('End is required');
            setSaving(false);
            return;
        }

        if (!values['Load time necessary'] || values['Load time necessary'] === '') {
            setError('Load time necessary is required');
            setSaving(false);
            return;
        }

        // If "Suggest Load times" is selected, validate load time fields
        if (values['Load time necessary'] === 'Suggest Load times') {
            if (!values['Proposed production load in start']) {
                setError('Load In Start is required when load times are suggested');
                setSaving(false);
                return;
            }
            if (!values['Proposed production load in end']) {
                setError('Load In End is required when load times are suggested');
                setSaving(false);
                return;
            }
            if (!values['Proposed production load out start']) {
                setError('Load Out Start is required when load times are suggested');
                setSaving(false);
                return;
            }
            if (!values['Proposed production load out end']) {
                setError('Load Out End is required when load times are suggested');
                setSaving(false);
                return;
            }
        }

        try {
            const epSubmissionTable = import.meta.env.VITE_EP_SUBMISSION_TABLE_NAME || import.meta.env.VITE_EP_SUBMISSION_TABLE_ID || 'EP Submission';
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

            // Close modal first
            onClose();
            
            // Call onSuccess with the new record ID so it can wait for it to be linked
            if (onSuccess) {
                onSuccess(newRecord.id);
            }
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
            <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-gray700 rounded-lg shadow-xl flex flex-col">
                {/* Sticky header */}
                <div className="sticky top-0 bg-white dark:bg-gray-gray700 border-b border-gray-gray200 dark:border-gray-gray600 px-6 py-4 z-10 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-gray800 dark:text-gray-gray100">Event Info Request</h2>
                    <button onClick={onClose} className="text-gray-gray500 hover:text-gray-gray700 dark:text-gray-gray300 dark:hover:text-gray-gray100">✕</button>
                </div>
                
                {/* Scrollable content */}
                <div className="overflow-y-auto flex-1 px-6 py-4">
                    <div className="mb-6 p-4 bg-gray-gray100 dark:bg-gray-gray600 border border-gray-gray300 dark:border-gray-gray500 rounded-md">
                        <p className="text-sm text-gray-gray700 dark:text-gray-gray200 mb-2">
                            To ensure a seamless planning process, we kindly ask you to provide the following details about the upcoming event. This information will assist us in tailoring our services to fit your needs and create an unforgettable experience. All fields marked with an asterisk (*) are required.
                        </p>
                        <p className="text-sm text-gray-gray700 dark:text-gray-gray200">
                            Thank you for your cooperation and we look forward to a successful event together!
                        </p>
                    </div>
                
                {error && (
                    <div className="mb-4 p-3 bg-red-red bg-opacity-10 border border-red-red rounded text-red-red text-sm">
                        {error}
                    </div>
                )}

                <form id="ep-submission-form" onSubmit={handleSubmit} className="space-y-4">
                    {/* Event Name */}
                    <div>
                        <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Event name for online communication <span className="text-red-red">*</span></label>
                        <p className="text-xs text-gray-gray500 dark:text-gray-gray400 mb-2">This name will be used for online event listing and marketing communication</p>
                        <input
                            type="text"
                            value={values['Eventname'] || ''}
                            onChange={(e) => setValues(prev => ({...prev, 'Eventname': e.target.value}))}
                            className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100"
                            required
                        />
                    </div>

                    {/* Locations */}
                    <div>
                            <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-2">Location <span className="text-red-red">*</span></label>
                            {loadingLocations ? (
                                <div className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-gray-gray50 dark:bg-gray-gray800 text-gray-gray600 dark:text-gray-gray400">
                                    Loading locations...
                                </div>
                            ) : (
                                <>
                                    {/* Selected locations as chips */}
                                    {(() => {
                                        const selectedIds = Array.isArray(values['Location']) ? values['Location'] : (values['Location'] ? [values['Location']] : []);
                                        const selectedLocations = locations.filter(loc => selectedIds.includes(loc.id));
                                        
                                        return (
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {selectedLocations.map(location => (
                                                    <div
                                                        key={location.id}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-blue text-white rounded-md text-sm"
                                                    >
                                                        <span>{location.name}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newIds = selectedIds.filter(id => id !== location.id);
                                                                setValues(prev => ({...prev, 'Location': newIds.length > 0 ? newIds : null}));
                                                            }}
                                                            className="ml-1 hover:bg-blue-700 rounded-full p-0.5 transition-colors"
                                                            aria-label={`Remove ${location.name}`}
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                    
                                    {/* Select Location button */}
                                    <button
                                        type="button"
                                        onClick={() => setShowLocationSelector(!showLocationSelector)}
                                        className="px-4 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100 hover:bg-gray-gray50 dark:hover:bg-gray-gray700 transition-colors text-sm font-medium"
                                    >
                                        Select Location
                                    </button>
                                    
                                    {/* Available locations to select (shown when expanded) */}
                                    {showLocationSelector && (
                                        <div className="mt-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md p-2 max-h-48 overflow-y-auto bg-white dark:bg-gray-gray800">
                                            <div className="flex flex-wrap gap-2">
                                                {locations.map(location => {
                                                    const selectedIds = Array.isArray(values['Location']) ? values['Location'] : (values['Location'] ? [values['Location']] : []);
                                                    const isSelected = selectedIds.includes(location.id);
                                                    
                                                    return (
                                                        <button
                                                            key={location.id}
                                                            type="button"
                                                            onClick={() => {
                                                                const currentIds = Array.isArray(values['Location']) ? values['Location'] : (values['Location'] ? [values['Location']] : []);
                                                                if (isSelected) {
                                                                    const newIds = currentIds.filter(id => id !== location.id);
                                                                    setValues(prev => ({...prev, 'Location': newIds.length > 0 ? newIds : null}));
                                                                } else {
                                                                    const newIds = [...currentIds, location.id];
                                                                    setValues(prev => ({...prev, 'Location': newIds}));
                                                                }
                                                            }}
                                                            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                                                                isSelected
                                                                    ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-blue text-blue-blue dark:text-blue-300'
                                                                    : 'bg-gray-gray50 dark:bg-gray-gray700 border-gray-gray300 dark:border-gray-gray600 text-gray-gray800 dark:text-gray-gray100 hover:bg-gray-gray100 dark:hover:bg-gray-gray600'
                                                            }`}
                                                        >
                                                            {location.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                    </div>

                    {/* Doors Open - End */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Doors Open <span className="text-red-red">*</span></label>
                            <input
                                type="datetime-local"
                                value={values['Doors open'] ? (() => {
                                    try {
                                        const date = new Date(values['Doors open']);
                                        if (isNaN(date.getTime())) return '';
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
                            <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">End <span className="text-red-red">*</span></label>
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
                    </div>

                    {/* Announcement date - Tickets on sale */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Proposed Announcement Date</label>
                            <p className="text-xs text-gray-gray500 dark:text-gray-gray400 mb-2">(If already known)</p>
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
                        <div>
                            <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Proposed Ticket on Sale Date</label>
                            <p className="text-xs text-gray-gray500 dark:text-gray-gray400 mb-2">(If already known)</p>
                            <input
                                type="date"
                                value={values['Tickets on sale'] ? (() => {
                                    try {
                                        const date = new Date(values['Tickets on sale']);
                                        if (isNaN(date.getTime())) return '';
                                        return date.toISOString().split('T')[0];
                                    } catch {
                                        return '';
                                    }
                                })() : ''}
                                onChange={(e) => setValues(prev => ({...prev, 'Tickets on sale': e.target.value || ''}))}
                                className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100"
                            />
                        </div>
                    </div>

                    {/* Proposed timetable */}
                    <div>
                        <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Proposed line-up (and timetable)</label>
                        <textarea
                            value={values['Proposed timetable'] || ''}
                            onChange={(e) => setValues(prev => ({...prev, 'Proposed timetable': e.target.value}))}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100"
                        />
                    </div>

                    {/* LOAD-IN AND OUT TIMES Section */}
                    <div className="mt-6 pt-6 border-t border-gray-gray200 dark:border-gray-gray600">
                        <h3 className="text-sm font-semibold text-gray-gray800 dark:text-gray-gray100 mb-4 uppercase">LOAD-IN AND OUT TIMES</h3>
                        <div className="mb-4">
                            <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-2">Will you need load-in time for extra production or deco? <span className="text-red-red">*</span></label>
                            <div className="space-y-2">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        name="load-time-necessary"
                                        value="No need for Load times"
                                        checked={values['Load time necessary'] === 'No need for Load times'}
                                        onChange={(e) => setValues(prev => ({...prev, 'Load time necessary': e.target.value}))}
                                        className="mr-2 text-blue-blue focus:ring-blue-blue"
                                    />
                                    <span className="text-sm text-gray-gray800 dark:text-gray-gray100">No need for Load times</span>
                                </label>
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        name="load-time-necessary"
                                        value="Suggest Load times"
                                        checked={values['Load time necessary'] === 'Suggest Load times'}
                                        onChange={(e) => setValues(prev => ({...prev, 'Load time necessary': e.target.value}))}
                                        className="mr-2 text-blue-blue focus:ring-blue-blue"
                                    />
                                    <span className="text-sm text-gray-gray800 dark:text-gray-gray100">Suggest Load times</span>
                                </label>
                            </div>
                        </div>

                        {values['Load time necessary'] === 'Suggest Load times' && (
                            <>
                                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                                    <p className="text-sm text-blue-800 dark:text-blue-300">
                                        These are the standard load-in and -out times we offer. If needed, please update them to the times you are planning. We will confirm your request as soon as possible.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Load In Start <span className="text-red-red">*</span></label>
                                        <input
                                            type="datetime-local"
                                            value={values['Proposed production load in start'] ? (() => {
                                                try {
                                                    const date = new Date(values['Proposed production load in start']);
                                                    if (isNaN(date.getTime())) return '';
                                                    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                                                    return localDate.toISOString().slice(0, 16);
                                                } catch {
                                                    return '';
                                                }
                                            })() : ''}
                                            onChange={(e) => setValues(prev => ({...prev, 'Proposed production load in start': e.target.value ? new Date(e.target.value).toISOString() : ''}))}
                                            className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Load In End <span className="text-red-red">*</span></label>
                                        <input
                                            type="datetime-local"
                                            value={values['Proposed production load in end'] ? (() => {
                                                try {
                                                    const date = new Date(values['Proposed production load in end']);
                                                    if (isNaN(date.getTime())) return '';
                                                    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                                                    return localDate.toISOString().slice(0, 16);
                                                } catch {
                                                    return '';
                                                }
                                            })() : ''}
                                            onChange={(e) => setValues(prev => ({...prev, 'Proposed production load in end': e.target.value ? new Date(e.target.value).toISOString() : ''}))}
                                            className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Load Out Start <span className="text-red-red">*</span></label>
                                        <input
                                            type="datetime-local"
                                            value={values['Proposed production load out start'] ? (() => {
                                                try {
                                                    const date = new Date(values['Proposed production load out start']);
                                                    if (isNaN(date.getTime())) return '';
                                                    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                                                    return localDate.toISOString().slice(0, 16);
                                                } catch {
                                                    return '';
                                                }
                                            })() : ''}
                                            onChange={(e) => setValues(prev => ({...prev, 'Proposed production load out start': e.target.value ? new Date(e.target.value).toISOString() : ''}))}
                                            className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Load Out End <span className="text-red-red">*</span></label>
                                        <input
                                            type="datetime-local"
                                            value={values['Proposed production load out end'] ? (() => {
                                                try {
                                                    const date = new Date(values['Proposed production load out end']);
                                                    if (isNaN(date.getTime())) return '';
                                                    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                                                    return localDate.toISOString().slice(0, 16);
                                                } catch {
                                                    return '';
                                                }
                                            })() : ''}
                                            onChange={(e) => setValues(prev => ({...prev, 'Proposed production load out end': e.target.value ? new Date(e.target.value).toISOString() : ''}))}
                                            className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100"
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* OTHER INFO Section */}
                    <div className="mt-6 pt-6 border-t border-gray-gray200 dark:border-gray-gray600">
                        <h3 className="text-sm font-semibold text-gray-gray800 dark:text-gray-gray100 mb-4 uppercase">OTHER INFO</h3>
                        <div>
                            <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Comment</label>
                            <textarea
                                value={values['Comment'] || ''}
                                onChange={(e) => setValues(prev => ({...prev, 'Comment': e.target.value}))}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100"
                            />
                        </div>
                    </div>
                </form>
                </div>
                
                {/* Sticky footer with buttons */}
                <div className="sticky bottom-0 bg-white dark:bg-gray-gray700 border-t border-gray-gray200 dark:border-gray-gray600 px-6 py-4 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray800 dark:text-gray-gray100 rounded-md hover:bg-gray-gray300 dark:hover:bg-gray-gray500"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="ep-submission-form"
                        disabled={saving}
                        className="px-4 py-2 bg-blue-blue text-white rounded-md hover:bg-opacity-90 disabled:opacity-60"
                    >
                        {saving ? 'Submitting...' : 'Submit Event Info Request'}
                    </button>
                </div>
            </div>
        </div>
    );
}

