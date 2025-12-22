import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import airtableApi from '../services/airtableApi.js';
import EPSubmissionModal from './EPSubmissionModal.jsx';
import { parseDate, formatDate, formatDateOnly } from '../utils/dateUtils.js';

function renderLocationValue(val) {
    if (!val) return '—';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
        return val.map((v, idx) => (
            <span key={idx} className="inline-block mr-2 mb-1 px-2 py-0.5 rounded bg-gray-gray100 dark:bg-gray-gray600 text-xs">
                {typeof v === 'string' ? v : (v?.name || v?.id || 'item')}
            </span>
        ));
    }
    if (typeof val === 'object') return val.name || val.id || '—';
    return String(val);
}

export default function EventDetails({ fieldMappings }) {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [event, setEvent] = React.useState(null);
    const [epSubmission, setEpSubmission] = React.useState(null);
    const [allSubmissions, setAllSubmissions] = React.useState([]); // Store all submissions
    const [selectedSubmissionId, setSelectedSubmissionId] = React.useState(null); // Currently selected submission ID
    const [showSubmissionDropdown, setShowSubmissionDropdown] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [loadingSubmission, setLoadingSubmission] = React.useState(false);
    const [error, setError] = React.useState('');
    const [showEPModal, setShowEPModal] = React.useState(false);

    React.useEffect(() => {
        async function loadEvent() {
            try {
                setLoading(true);
                setError('');
                const tableName = import.meta.env.VITE_TABLE_NAME || import.meta.env.VITE_TABLE_ID;
                const epSubmissionLinkField = import.meta.env.VITE_EP_SUBMISSION_LINK_FIELD || 'EP Submission';
                
                // First, load event with raw IDs to get EP Submission record ID
                const rawRecord = await airtableApi.getRecord(tableName, eventId, { noQuery: true });
                
                // Load all EP Submissions if linked
                const epSubmissionIds = rawRecord.fields?.[epSubmissionLinkField];
                if (epSubmissionIds && Array.isArray(epSubmissionIds) && epSubmissionIds.length > 0) {
                    // Convert to array of IDs if needed
                    const linkedIds = epSubmissionIds.map(id => typeof id === 'object' ? id.id : id);
                    try {
                        setLoadingSubmission(true);
                        const epSubmissionTable = import.meta.env.VITE_EP_SUBMISSION_TABLE_NAME || import.meta.env.VITE_EP_SUBMISSION_TABLE_ID || 'EP Submission';
                        console.log('[EventDetails] Fetching all EP Submissions:', { table: epSubmissionTable, totalLinked: linkedIds.length });
                        
                        // Load all submissions
                        const submissionPromises = linkedIds.map(id => 
                            airtableApi.getRecord(epSubmissionTable, id, {
                                cellFormat: 'string',
                                timeZone: 'Europe/Zurich',
                                userLocale: 'en-GB'
                            }).catch(err => {
                                console.error(`[EventDetails] Failed to load submission ${id}:`, err);
                                return null;
                            })
                        );
                        
                        const submissions = (await Promise.all(submissionPromises)).filter(Boolean);
                        
                        // Sort by Date field (most recent first) - assuming Date field exists
                        if (Array.isArray(submissions) && submissions.length > 0) {
                            try {
                                submissions.sort((a, b) => {
                                    try {
                                        const dateA = a?.fields?.['Date'] ? parseDate(a.fields['Date']) : null;
                                        const dateB = b?.fields?.['Date'] ? parseDate(b.fields['Date']) : null;
                                        if (!dateA && !dateB) return 0;
                                        if (!dateA) return 1;
                                        if (!dateB) return -1;
                                        return dateB - dateA; // Most recent first
                                    } catch (err) {
                                        console.warn('[EventDetails] Error parsing date in sort:', err);
                                        return 0;
                                    }
                                });
                            } catch (err) {
                                console.error('[EventDetails] Error sorting submissions:', err);
                            }
                            
                            setAllSubmissions(submissions);
                            
                            // Set the latest submission as default (first in sorted array)
                            if (submissions[0] && submissions[0].id) {
                                setEpSubmission(submissions[0]);
                                setSelectedSubmissionId(submissions[0].id);
                            } else {
                                setEpSubmission(null);
                                setSelectedSubmissionId(null);
                            }
                        } else {
                            setAllSubmissions([]);
                            setEpSubmission(null);
                            setSelectedSubmissionId(null);
                        }
                    } catch (subErr) {
                        console.error('Failed to load EP Submissions:', subErr);
                        setEpSubmission(null);
                        setAllSubmissions([]);
                        setSelectedSubmissionId(null);
                    } finally {
                        setLoadingSubmission(false);
                    }
                } else {
                    setEpSubmission(null);
                    setAllSubmissions([]);
                    setSelectedSubmissionId(null);
                }
                
                // Load event with formatted fields for display
                const record = await airtableApi.getRecord(tableName, eventId, {
                    cellFormat: 'string',
                    timeZone: 'Europe/Zurich',
                    userLocale: 'en-GB'
                });
                setEvent(record);
            } catch (err) {
                console.error('Failed to load event:', err);
                setError(err?.message || 'Failed to load event details');
            } finally {
                setLoading(false);
            }
        }
        if (eventId) {
            loadEvent();
        }
    }, [eventId]);

    const handleEPSubmissionSuccess = async (newSubmissionId) => {
        // Wait for the newly created submission to be linked to the event
        const tableName = import.meta.env.VITE_TABLE_NAME || import.meta.env.VITE_TABLE_ID;
        const epSubmissionLinkField = import.meta.env.VITE_EP_SUBMISSION_LINK_FIELD || 'EP Submission';
        const epSubmissionTable = import.meta.env.VITE_EP_SUBMISSION_TABLE_NAME || import.meta.env.VITE_EP_SUBMISSION_TABLE_ID || 'EP Submission';
        
        if (!newSubmissionId) {
            console.warn('[EventDetails] No submission ID provided to handleEPSubmissionSuccess');
            return;
        }
        
        setLoadingSubmission(true);
        
        // Retry logic: wait for Airtable to propagate the link (up to 10 attempts with increasing delays)
        const maxRetries = 10;
        const baseDelay = 300; // Start with 300ms delay
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Wait before checking (except on first attempt)
                if (attempt > 0) {
                    const delay = baseDelay * Math.pow(1.5, attempt - 1); // Exponential backoff: 300ms, 450ms, 675ms, etc.
                    console.log(`[EventDetails] Waiting ${Math.round(delay)}ms before retry ${attempt + 1}/${maxRetries}...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                // Load event with raw IDs to check if submission is linked
                const rawRecord = await airtableApi.getRecord(tableName, eventId, { noQuery: true });
                
                // Check if the new submission ID is in the linked submissions
                const epSubmissionIds = rawRecord.fields?.[epSubmissionLinkField];
                const linkedIds = Array.isArray(epSubmissionIds) 
                    ? epSubmissionIds.map(id => typeof id === 'object' ? id.id : id)
                    : [];
                
                console.log(`[EventDetails] Attempt ${attempt + 1}/${maxRetries}: Looking for submission ${newSubmissionId} in linked IDs:`, linkedIds);
                
                if (linkedIds.includes(newSubmissionId)) {
                    // Found it! Load all submissions
                    try {
                        // Load all submissions
                        const submissionPromises = linkedIds.map(id => 
                            airtableApi.getRecord(epSubmissionTable, id, {
                                cellFormat: 'string',
                                timeZone: 'Europe/Zurich',
                                userLocale: 'en-GB'
                            }).catch(err => {
                                console.error(`[EventDetails] Failed to load submission ${id}:`, err);
                                return null;
                            })
                        );
                        
                        const submissions = (await Promise.all(submissionPromises)).filter(Boolean);
                        
                        // Sort by Date field (most recent first)
                        submissions.sort((a, b) => {
                            const dateA = a.fields?.['Date'] ? parseDate(a.fields['Date']) : null;
                            const dateB = b.fields?.['Date'] ? parseDate(b.fields['Date']) : null;
                            if (!dateA && !dateB) return 0;
                            if (!dateA) return 1;
                            if (!dateB) return -1;
                            return dateB - dateA; // Most recent first
                        });
                        
                        setAllSubmissions(submissions);
                        
                        // Set the new submission as selected (should be first in sorted array)
                        if (submissions.length > 0) {
                            setEpSubmission(submissions[0]);
                            setSelectedSubmissionId(submissions[0].id);
                        }
                        
                        // Load event with formatted fields for display
                        const record = await airtableApi.getRecord(tableName, eventId, {
                            cellFormat: 'string',
                            timeZone: 'Europe/Zurich',
                            userLocale: 'en-GB'
                        });
                        setEvent(record);
                        
                        setLoadingSubmission(false);
                        console.log(`[EventDetails] ✓ Successfully loaded all EP Submissions after ${attempt + 1} attempt(s)`);
                        return; // Exit the retry loop
                    } catch (subErr) {
                        console.error(`[EventDetails] Failed to load EP Submissions (attempt ${attempt + 1}/${maxRetries}):`, subErr);
                        // Continue to next retry
                    }
                } else {
                    console.log(`[EventDetails] Submission ${newSubmissionId} not yet linked to event (attempt ${attempt + 1}/${maxRetries})`);
                    // Continue to next retry
                }
            } catch (err) {
                console.error(`[EventDetails] Error checking for submission link (attempt ${attempt + 1}/${maxRetries}):`, err);
                // Continue to next retry
            }
        }
        
        // If we've exhausted all retries, try one final reload
        console.warn('[EventDetails] Could not find linked submission after all retries, attempting final reload...');
        try {
            const record = await airtableApi.getRecord(tableName, eventId, {
                cellFormat: 'string',
                timeZone: 'Europe/Zurich',
                userLocale: 'en-GB'
            });
            setEvent(record);
            
            // Try one more time to load all submissions
            const rawRecord = await airtableApi.getRecord(tableName, eventId, { noQuery: true });
            const epSubmissionIds = rawRecord.fields?.[epSubmissionLinkField];
            if (epSubmissionIds && Array.isArray(epSubmissionIds) && epSubmissionIds.length > 0) {
                const linkedIds = epSubmissionIds.map(id => typeof id === 'object' ? id.id : id);
                
                try {
                    const submissionPromises = linkedIds.map(id => 
                        airtableApi.getRecord(epSubmissionTable, id, {
                            cellFormat: 'string',
                            timeZone: 'Europe/Zurich',
                            userLocale: 'en-GB'
                        }).catch(err => {
                            console.error(`[EventDetails] Failed to load submission ${id}:`, err);
                            return null;
                        })
                    );
                    
                    const submissions = (await Promise.all(submissionPromises)).filter(Boolean);
                    
                    // Sort by Date field (most recent first)
                    try {
                        submissions.sort((a, b) => {
                            try {
                                const dateA = a.fields?.['Date'] ? parseDate(a.fields['Date']) : null;
                                const dateB = b.fields?.['Date'] ? parseDate(b.fields['Date']) : null;
                                if (!dateA && !dateB) return 0;
                                if (!dateA) return 1;
                                if (!dateB) return -1;
                                return dateB - dateA; // Most recent first
                            } catch (err) {
                                console.warn('[EventDetails] Error parsing date in sort:', err);
                                return 0;
                            }
                        });
                    } catch (err) {
                        console.error('[EventDetails] Error sorting submissions:', err);
                    }
                    
                    setAllSubmissions(submissions);
                    
                    if (submissions.length > 0) {
                        setEpSubmission(submissions[0]);
                        setSelectedSubmissionId(submissions[0].id);
                    }
                    console.log('[EventDetails] ✓ Loaded all submissions on final attempt');
                } catch (subErr) {
                    console.error('Failed to load EP Submissions on final attempt:', subErr);
                }
            }
        } catch (err) {
            console.error('Failed to reload event on final attempt:', err);
        } finally {
            setLoadingSubmission(false);
        }
    };

    // Check if event is in the future and has no EP Submission
    const needsEPSubmission = React.useMemo(() => {
        if (!event) return false;
        const startDate = event.fields?.[fieldMappings.startDateField];
        if (!startDate) return false;
        
        const eventDate = parseDate(startDate);
        if (!eventDate) return false;
        
        const now = new Date();
        const isFuture = eventDate > now;
        
        const epSubmissionLinkField = import.meta.env.VITE_EP_SUBMISSION_LINK_FIELD || 'EP Submission';
        const epSubmission = event.fields?.[epSubmissionLinkField];
        const hasEPSubmission = epSubmission && (Array.isArray(epSubmission) ? epSubmission.length > 0 : true);
        
        return isFuture && !hasEPSubmission;
    }, [event, fieldMappings]);

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (showSubmissionDropdown && !event.target.closest('.submission-dropdown-container')) {
                setShowSubmissionDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showSubmissionDropdown]);

    if (loading) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-gray50 dark:bg-gray-gray800">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-gray600 dark:text-gray-gray300">Loading event details...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-gray50 dark:bg-gray-gray800">
                <div className="max-w-2xl w-full bg-white dark:bg-gray-gray700 rounded-lg shadow-xl p-8">
                    <p className="text-red-red mb-4">{error}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 bg-blue-blue text-white rounded-md hover:bg-opacity-90"
                    >
                        Back to Events
                    </button>
                </div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-gray50 dark:bg-gray-gray800">
                <div className="max-w-2xl w-full bg-white dark:bg-gray-gray700 rounded-lg shadow-xl p-8">
                    <p className="text-gray-gray600 dark:text-gray-gray300 mb-4">Event not found</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 bg-blue-blue text-white rounded-md hover:bg-opacity-90"
                    >
                        Back to Events
                    </button>
                </div>
            </div>
        );
    }

    const eventName = event.fields?.[fieldMappings.eventNameField] || event.fields?.Name || 'Untitled Event';

    // Handle submission selection change
    const handleSubmissionChange = (submissionId) => {
        const selected = allSubmissions.find(s => s.id === submissionId);
        if (selected) {
            setEpSubmission(selected);
            setSelectedSubmissionId(submissionId);
            setShowSubmissionDropdown(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-gray-gray50 dark:bg-gray-gray800">
            <div className="max-w-4xl mx-auto p-4 sm:p-6">
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/')}
                        className="text-blue-blue hover:underline text-sm mb-4 inline-block"
                    >
                        ← Back to Events
                    </button>
                    <h1 className="text-2xl font-bold text-gray-gray800 dark:text-gray-gray100">{eventName}</h1>
                </div>

                {needsEPSubmission && (
                    <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-600 rounded-lg flex items-center justify-between">
                        <span className="text-yellow-800 dark:text-yellow-300">Please submit info</span>
                        <button
                            onClick={() => setShowEPModal(true)}
                            className="px-4 py-2 bg-blue-blue text-white rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium"
                        >
                            Create EP Submission
                        </button>
                    </div>
                )}

                <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow p-6">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Start</dt>
                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{formatDate(event.fields?.[fieldMappings.startDateField]) || '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">End</dt>
                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{formatDate(event.fields?.[fieldMappings.endDateField]) || '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Proposed Announcement Date</dt>
                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">
                                {formatDateOnly(event.fields?.[fieldMappings.proposedAnnouncementDateField] || event.fields?.['Announcement date']) || '—'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Proposed Ticket on Sale Date</dt>
                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{formatDate(event.fields?.[fieldMappings.publicTicketReleaseDateField]) || '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Location</dt>
                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">
                                {renderLocationValue(event.fields?.[fieldMappings.locationField])}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Proposed line-up (and timetable)</dt>
                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 whitespace-pre-wrap">{event.fields?.[fieldMappings.proposedLineupField] || '—'}</dd>
                        </div>
                    </dl>
                </div>

                {(epSubmission || loadingSubmission) && (
                    <div className="mt-6">
                        {epSubmission && Array.isArray(allSubmissions) && allSubmissions.length > 0 && (
                            <div className="relative mb-4 submission-dropdown-container">
                                <button
                                    onClick={() => setShowSubmissionDropdown(!showSubmissionDropdown)}
                                    className="flex items-center gap-2 text-xl font-semibold text-gray-gray800 dark:text-gray-gray100 hover:text-blue-blue transition-colors"
                                >
                                    {(() => {
                                        const submissionDate = epSubmission.fields?.['Date'];
                                        const formattedDate = submissionDate ? formatDate(submissionDate) : '';
                                        return formattedDate ? `Submission ${formattedDate}` : 'Submission';
                                    })()}
                                    {allSubmissions && allSubmissions.length > 1 && (
                                        <svg 
                                            className={`w-5 h-5 transition-transform ${showSubmissionDropdown ? 'rotate-180' : ''}`}
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    )}
                                </button>
                                
                                {showSubmissionDropdown && Array.isArray(allSubmissions) && allSubmissions.length > 1 && (
                                    <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-gray700 rounded-lg shadow-lg border border-gray-gray200 dark:border-gray-gray600 z-10 max-h-96 overflow-y-auto">
                                        {allSubmissions.map((submission) => {
                                            const submissionDate = submission.fields?.['Date'];
                                            const formattedDate = submissionDate ? formatDate(submissionDate) : 'No date';
                                            const isSelected = submission.id === selectedSubmissionId;
                                            return (
                                                <button
                                                    key={submission.id}
                                                    onClick={() => handleSubmissionChange(submission.id)}
                                                    className={`w-full text-left px-4 py-3 hover:bg-gray-gray50 dark:hover:bg-gray-gray600 transition-colors ${
                                                        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-blue' : ''
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-sm ${isSelected ? 'font-medium text-blue-blue' : 'text-gray-gray800 dark:text-gray-gray100'}`}>
                                                            {formattedDate}
                                                        </span>
                                                        {isSelected && (
                                                            <svg className="w-4 h-4 text-blue-blue" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                        {!epSubmission && loadingSubmission && (
                            <div className="mb-4">
                                <div className="text-xl font-semibold text-gray-gray800 dark:text-gray-gray100">Submission</div>
                            </div>
                        )}
                        <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow p-6">
                            {loadingSubmission ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-8 h-8 border-4 border-blue-blue border-t-transparent rounded-full animate-spin"></div>
                                    <span className="ml-3 text-gray-gray600 dark:text-gray-gray300">Loading submission...</span>
                                </div>
                            ) : epSubmission && (
                                <>
                                    {/* Block 1: General Info */}
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-gray-gray800 dark:text-gray-gray100">General Info</h3>
                                            {(() => {
                                                const approveEventInfo = epSubmission.fields?.['Approve Event Info'];
                                                const isApproved = approveEventInfo === true || approveEventInfo === 'true' || approveEventInfo === 1 || approveEventInfo === '1';
                                                return (
                                                    <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                                                        isApproved 
                                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                                                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                                                    }`}>
                                                        {isApproved ? 'Approved' : 'Pending'}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow p-6">
                                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {/* Event Name - full width */}
                                                <div className="sm:col-span-2">
                                                    <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Event Name</dt>
                                                    <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{epSubmission.fields?.['Eventname'] || '—'}</dd>
                                                </div>
                                                
                                                {/* Start - End on same row */}
                                                <div>
                                                    <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Start</dt>
                                                    <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{formatDate(epSubmission.fields?.['Doors open']) || '—'}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">End</dt>
                                                    <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{formatDate(epSubmission.fields?.['End']) || '—'}</dd>
                                                </div>
                                                
                                                {/* Proposed Announcement Date - Proposed Ticket on Sale Date on same row */}
                                                <div>
                                                    <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Proposed Announcement Date</dt>
                                                    <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{formatDateOnly(epSubmission.fields?.['Announcement date']) || '—'}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Proposed Ticket on Sale Date</dt>
                                                    <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">
                                                        {formatDateOnly(epSubmission.fields?.['Tickets on sale']) || 
                                                         formatDateOnly(epSubmission.fields?.['Tickets on Sale']) || 
                                                         formatDateOnly(epSubmission.fields?.['Public ticket release']) ||
                                                         formatDateOnly(epSubmission.fields?.['Public ticket release date']) ||
                                                         '—'}
                                                    </dd>
                                                </div>
                                                
                                                {/* Location - Proposed line-up (and timetable) on same row */}
                                                <div>
                                                    <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Location</dt>
                                                    <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">
                                                        {renderLocationValue(epSubmission.fields?.['Location'])}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Proposed line-up (and timetable)</dt>
                                                    <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 whitespace-pre-wrap">{epSubmission.fields?.['Proposed timetable'] || '—'}</dd>
                                                </div>
                                                
                                                {/* Comment - full width */}
                                                <div className="sm:col-span-2">
                                                    <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Comment</dt>
                                                    <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 whitespace-pre-wrap">{epSubmission.fields?.['Comment'] || '—'}</dd>
                                                </div>
                                            </dl>
                                        </div>
                                    </div>

                                    {/* Block 2: Load In/Out Times */}
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-gray-gray800 dark:text-gray-gray100">Load In/Out Times</h3>
                                            {(() => {
                                                const loadTimeApproval = epSubmission.fields?.['Load Time Approval'];
                                                // Handle different possible formats (boolean, string, number)
                                                const isApproved = loadTimeApproval === true || loadTimeApproval === 'true' || loadTimeApproval === 1 || loadTimeApproval === '1';
                                                // If it's a string value, display it; otherwise show Approved/Pending
                                                const statusText = typeof loadTimeApproval === 'string' && loadTimeApproval !== 'true' && loadTimeApproval !== 'false' && loadTimeApproval !== '1' && loadTimeApproval !== '0'
                                                    ? loadTimeApproval
                                                    : (isApproved ? 'Approved' : 'Pending');
                                                const statusColor = typeof loadTimeApproval === 'string' && loadTimeApproval !== 'true' && loadTimeApproval !== 'false' && loadTimeApproval !== '1' && loadTimeApproval !== '0'
                                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                                    : (isApproved 
                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                                                        : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300');
                                                
                                                return loadTimeApproval !== null && loadTimeApproval !== undefined && loadTimeApproval !== '' ? (
                                                    <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${statusColor}`}>
                                                        {statusText}
                                                    </span>
                                                ) : null;
                                            })()}
                                        </div>
                                        <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow p-6">
                                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {(() => {
                                                    // Calculate load times from event record if submission fields are empty
                                                    const doorsOpenStr = event?.fields?.[fieldMappings.startDateField];
                                                    const endStr = event?.fields?.[fieldMappings.endDateField];
                                                    const doorsOpen = doorsOpenStr ? parseDate(doorsOpenStr) : null;
                                                    const end = endStr ? parseDate(endStr) : null;

                                                    // Get submission field values
                                                    const loadInStartSubmission = epSubmission.fields?.['Proposed production load in start'];
                                                    const loadInEndSubmission = epSubmission.fields?.['Proposed production load in end'];
                                                    const loadOutStartSubmission = epSubmission.fields?.['Proposed production load out start'];
                                                    const loadOutEndSubmission = epSubmission.fields?.['Proposed production load out end'];

                                                    // Calculate from event if submission fields are empty
                                                    let loadInStart = loadInStartSubmission;
                                                    let loadInEnd = loadInEndSubmission;
                                                    let loadOutStart = loadOutStartSubmission;
                                                    let loadOutEnd = loadOutEndSubmission;

                                                    if (!loadInStart && doorsOpen) {
                                                        const loadInStartDate = new Date(doorsOpen.getTime() - 4 * 60 * 60 * 1000);
                                                        loadInStart = loadInStartDate.toISOString();
                                                    }
                                                    if (!loadInEnd && doorsOpen) {
                                                        const loadInEndDate = new Date(doorsOpen.getTime() - 2 * 60 * 60 * 1000);
                                                        loadInEnd = loadInEndDate.toISOString();
                                                    }
                                                    if (!loadOutStart && end) {
                                                        const loadOutStartDate = new Date(end.getTime() + 0.5 * 60 * 60 * 1000);
                                                        loadOutStart = loadOutStartDate.toISOString();
                                                    }
                                                    if (!loadOutEnd && end) {
                                                        const loadOutEndDate = new Date(end.getTime() + 1.5 * 60 * 60 * 1000);
                                                        loadOutEnd = loadOutEndDate.toISOString();
                                                    }

                                                    return (
                                                        <>
                                                            <div>
                                                                <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Load In Start</dt>
                                                                <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{loadInStart ? formatDate(loadInStart) : '—'}</dd>
                                                            </div>
                                                            <div>
                                                                <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Load In End</dt>
                                                                <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{loadInEnd ? formatDate(loadInEnd) : '—'}</dd>
                                                            </div>
                                                            <div>
                                                                <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Load Out Start</dt>
                                                                <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{loadOutStart ? formatDate(loadOutStart) : '—'}</dd>
                                                            </div>
                                                            <div>
                                                                <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Load Out End</dt>
                                                                <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{loadOutEnd ? formatDate(loadOutEnd) : '—'}</dd>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </dl>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <EPSubmissionModal
                open={showEPModal}
                onClose={() => setShowEPModal(false)}
                event={event}
                fieldMappings={fieldMappings}
                onSuccess={handleEPSubmissionSuccess}
            />
        </div>
    );
}

