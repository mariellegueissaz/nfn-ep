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
    
    // Separate submissions by Load times field
    const generalSubmissions = React.useMemo(() => {
        return allSubmissions.filter(sub => {
            const loadTimes = sub?.fields?.['Load times'];
            // Check if it's explicitly false or not set (checkbox unchecked or undefined)
            const isFalse = loadTimes === false || loadTimes === null || loadTimes === undefined || loadTimes === '';
            // Also check that it's NOT true
            const isNotTrue = !(loadTimes === true || loadTimes === 1);
            return isFalse || isNotTrue;
        });
    }, [allSubmissions]);
    
    const loadTimeSubmissions = React.useMemo(() => {
        return allSubmissions.filter(sub => {
            const loadTimes = sub?.fields?.['Load times'];
            const loadTimeNecessary = sub?.fields?.['Load time necessary'];
            // Check for true in checkbox format (true or 1) AND Load time necessary must not be empty
            const hasLoadTimes = loadTimes === true || loadTimes === 1;
            const hasLoadTimeNecessary = loadTimeNecessary && loadTimeNecessary !== '' && loadTimeNecessary !== null && loadTimeNecessary !== undefined;
            return hasLoadTimes && hasLoadTimeNecessary;
        });
    }, [allSubmissions]);
    
    // Selected submissions for each section
    const [selectedGeneralSubmissionId, setSelectedGeneralSubmissionId] = React.useState(null);
    const [selectedLoadTimeSubmissionId, setSelectedLoadTimeSubmissionId] = React.useState(null);
    const [showGeneralDropdown, setShowGeneralDropdown] = React.useState(false);
    const [showLoadTimeDropdown, setShowLoadTimeDropdown] = React.useState(false);
    
    // Get selected submissions
    const selectedGeneralSubmission = React.useMemo(() => {
        return generalSubmissions.find(s => s.id === selectedGeneralSubmissionId) || generalSubmissions[0] || null;
    }, [generalSubmissions, selectedGeneralSubmissionId]);
    
    const selectedLoadTimeSubmission = React.useMemo(() => {
        return loadTimeSubmissions.find(s => s.id === selectedLoadTimeSubmissionId) || loadTimeSubmissions[0] || null;
    }, [loadTimeSubmissions, selectedLoadTimeSubmissionId]);
    
    // Set initial selected submissions when data loads
    React.useEffect(() => {
        // Reset and set general submission
        if (generalSubmissions.length > 0) {
            const currentId = selectedGeneralSubmissionId;
            const exists = generalSubmissions.some(s => s.id === currentId);
            if (!exists || !currentId) {
                setSelectedGeneralSubmissionId(generalSubmissions[0].id);
            }
        } else {
            setSelectedGeneralSubmissionId(null);
        }
        
        // Reset and set load time submission
        if (loadTimeSubmissions.length > 0) {
            const currentId = selectedLoadTimeSubmissionId;
            const exists = loadTimeSubmissions.some(s => s.id === currentId);
            if (!exists || !currentId) {
                setSelectedLoadTimeSubmissionId(loadTimeSubmissions[0].id);
            }
        } else {
            setSelectedLoadTimeSubmissionId(null);
        }
    }, [generalSubmissions, loadTimeSubmissions, selectedGeneralSubmissionId, selectedLoadTimeSubmissionId]);
    const [loading, setLoading] = React.useState(true);
    const [loadingSubmission, setLoadingSubmission] = React.useState(false);
    const [error, setError] = React.useState('');
    const [showEPModal, setShowEPModal] = React.useState(false);
    const [isNewSubmission, setIsNewSubmission] = React.useState(false);

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
                        
                        // Load all submissions - fetch without cellFormat first to get checkbox values, then fetch with string format for display
                        const submissionPromises = linkedIds.map(async id => {
                            try {
                                // First fetch without cellFormat to get checkbox values
                                const rawRecord = await airtableApi.getRecord(epSubmissionTable, id, { noQuery: true });
                                // Then fetch with string format for display
                                const formattedRecord = await airtableApi.getRecord(epSubmissionTable, id, {
                                cellFormat: 'string',
                                timeZone: 'Europe/Zurich',
                                userLocale: 'en-GB'
                                });
                                // Merge checkbox field from raw record into formatted record
                                if (rawRecord?.fields?.['Load times'] !== undefined) {
                                    formattedRecord.fields['Load times'] = rawRecord.fields['Load times'];
                                }
                                return formattedRecord;
                            } catch (err) {
                                console.error(`[EventDetails] Failed to load submission ${id}:`, err);
                                return null;
                            }
                        });
                        
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
                        // Load all submissions - fetch raw first to get checkbox, then formatted for display
                        const submissionPromises = linkedIds.map(async id => {
                            try {
                                // Fetch raw record to get checkbox value and Load time necessary field
                                const rawRecord = await airtableApi.getRecord(epSubmissionTable, id, { noQuery: true });
                                // Fetch formatted record for display
                                const formattedRecord = await airtableApi.getRecord(epSubmissionTable, id, {
                                cellFormat: 'string',
                                timeZone: 'Europe/Zurich',
                                userLocale: 'en-GB'
                                });
                                // Merge checkbox field and Load time necessary from raw record into formatted record
                                if (rawRecord?.fields?.['Load times'] !== undefined) {
                                    formattedRecord.fields['Load times'] = rawRecord.fields['Load times'];
                                }
                                if (rawRecord?.fields?.['Load time necessary'] !== undefined) {
                                    formattedRecord.fields['Load time necessary'] = rawRecord.fields['Load time necessary'];
                                }
                                return formattedRecord;
                            } catch (err) {
                                console.error(`[EventDetails] Failed to load submission ${id}:`, err);
                                return null;
                            }
                        });
                        
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

    // Close dropdowns when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (showSubmissionDropdown && !event.target.closest('.submission-dropdown-container')) {
                setShowSubmissionDropdown(false);
            }
            if (showGeneralDropdown && !event.target.closest('.submission-dropdown-container')) {
                setShowGeneralDropdown(false);
            }
            if (showLoadTimeDropdown && !event.target.closest('.submission-dropdown-container')) {
                setShowLoadTimeDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showSubmissionDropdown, showGeneralDropdown, showLoadTimeDropdown]);

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
    
    // Handle general submission selection change
    const handleGeneralSubmissionChange = (submissionId) => {
        setSelectedGeneralSubmissionId(submissionId);
        setShowGeneralDropdown(false);
    };
    
    // Handle load time submission selection change
    const handleLoadTimeSubmissionChange = (submissionId) => {
        setSelectedLoadTimeSubmissionId(submissionId);
        setShowLoadTimeDropdown(false);
    };
    
    // Helper function to render submission dropdown
    const renderSubmissionDropdown = (submissions, selectedId, showDropdown, setShowDropdown, onChange) => {
        if (!submissions || submissions.length <= 1) return null;
        
        const selectedSubmission = submissions.find(s => s.id === selectedId) || submissions[0];
        const submissionDate = selectedSubmission?.fields?.['Date'];
        const formattedDate = submissionDate ? formatDate(submissionDate) : 'No date';
        
        return (
            <div className="relative mb-4 submission-dropdown-container">
                <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2 text-xl font-semibold text-gray-gray800 dark:text-gray-gray100 hover:text-blue-blue transition-colors"
                >
                    {formattedDate ? `Submission ${formattedDate}` : 'Submission'}
                    <svg 
                        className={`w-5 h-5 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                
                {showDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-gray700 rounded-lg shadow-lg border border-gray-gray200 dark:border-gray-gray600 z-10 max-h-96 overflow-y-auto">
                        {submissions.map((submission) => {
                            const subDate = submission.fields?.['Date'];
                            const formattedSubDate = subDate ? formatDate(subDate) : 'No date';
                            const isSelected = submission.id === selectedId;
                            return (
                                <button
                                    key={submission.id}
                                    onClick={() => onChange(submission.id)}
                                    className={`w-full text-left px-4 py-3 hover:bg-gray-gray50 dark:hover:bg-gray-gray600 transition-colors ${
                                        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-blue' : ''
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className={`text-sm ${isSelected ? 'font-medium text-blue-blue' : 'text-gray-gray800 dark:text-gray-gray100'}`}>
                                            {formattedSubDate}
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
        );
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
                            onClick={() => {
                                setIsNewSubmission(false);
                                setShowEPModal(true);
                            }}
                            className="px-4 py-2 bg-blue-blue text-white rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium"
                        >
                            Create EP Submission
                        </button>
                    </div>
                )}

                <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow p-6">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                        <div>
                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Start
                            </dt>
                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{formatDate(event.fields?.[fieldMappings.startDateField]) || '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                End
                            </dt>
                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{formatDate(event.fields?.[fieldMappings.endDateField]) || '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Proposed Announcement Date
                            </dt>
                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">
                                {formatDateOnly(event.fields?.[fieldMappings.proposedAnnouncementDateField] || event.fields?.['Announcement date']) || '—'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Proposed Ticket on Sale Date
                            </dt>
                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{formatDate(event.fields?.[fieldMappings.publicTicketReleaseDateField]) || '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Location
                            </dt>
                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">
                                {renderLocationValue(event.fields?.[fieldMappings.locationField])}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                                Proposed line-up (and timetable)
                            </dt>
                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 whitespace-pre-wrap">{event.fields?.[fieldMappings.proposedLineupField] || '—'}</dd>
                        </div>
                    </dl>
                </div>

                {(generalSubmissions.length > 0 || loadTimeSubmissions.length > 0 || loadingSubmission) && (
                    <div className="mt-6">
                        {loadingSubmission ? (
                            <div className="mb-4">
                                <div className="text-xl font-semibold text-gray-gray800 dark:text-gray-gray100">Loading submissions...</div>
                            </div>
                        ) : (
                            <>
                                {/* General Info Section */}
                                {generalSubmissions.length > 0 && (
                                    <div className="mb-6">
                                        <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow p-6">
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-gray-gray800 dark:text-gray-gray100">General Info</h3>
                                            {(() => {
                                                const approveEventInfo = selectedGeneralSubmission?.fields?.['Approve Event Info'];
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
                                        
                                        {/* Submission dropdown and New Submission button */}
                                        <div className="mb-4">
                                            {renderSubmissionDropdown(
                                                generalSubmissions,
                                                selectedGeneralSubmissionId,
                                                showGeneralDropdown,
                                                setShowGeneralDropdown,
                                                handleGeneralSubmissionChange
                                            )}
                                            {generalSubmissions.length > 0 && (
                                                <div className="flex items-center gap-3 mt-2">
                                                    {(() => {
                                                        const selectedSubmission = generalSubmissions.find(s => s.id === selectedGeneralSubmissionId) || generalSubmissions[0];
                                                        const submissionDate = selectedSubmission?.fields?.['Date'];
                                                        const formattedDate = submissionDate ? formatDate(submissionDate) : 'No date';
                                                        if (generalSubmissions.length === 1) {
                                                            return (
                                                                <span className="text-sm text-gray-gray600 dark:text-gray-gray400">
                                                                    Submission {formattedDate}
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                    <button
                                                        onClick={() => {
                                                            setIsNewSubmission(true);
                                                            setShowEPModal(true);
                                                        }}
                                                        className="px-3 py-1.5 text-sm bg-blue-blue text-white rounded-md hover:bg-opacity-90 transition-colors"
                                                    >
                                                        + New Submission
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                                                {/* Event Name - full width */}
                                                <div className="sm:col-span-2">
                                                    <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Event Name</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{selectedGeneralSubmission?.fields?.['Eventname'] || '—'}</dd>
                                                </div>
                                                
                                                {/* Start - End on same row */}
                                                <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                Start
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{formatDate(selectedGeneralSubmission?.fields?.['Doors open']) || '—'}</dd>
                                                </div>
                                                <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                End
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{formatDate(selectedGeneralSubmission?.fields?.['End']) || '—'}</dd>
                                                </div>
                                                
                                                {/* Proposed Announcement Date - Proposed Ticket on Sale Date on same row */}
                                                <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                Proposed Announcement Date
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{formatDateOnly(selectedGeneralSubmission?.fields?.['Announcement date']) || '—'}</dd>
                                                </div>
                                                <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                Proposed Ticket on Sale Date
                                                            </dt>
                                                    <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">
                                                                {formatDateOnly(selectedGeneralSubmission?.fields?.['Tickets on sale']) || 
                                                                 formatDateOnly(selectedGeneralSubmission?.fields?.['Tickets on Sale']) || 
                                                                 formatDateOnly(selectedGeneralSubmission?.fields?.['Public ticket release']) ||
                                                                 formatDateOnly(selectedGeneralSubmission?.fields?.['Public ticket release date']) ||
                                                         '—'}
                                                    </dd>
                                                </div>
                                                
                                                {/* Location - Proposed line-up (and timetable) on same row */}
                                                <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                </svg>
                                                                Location
                                                            </dt>
                                                    <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">
                                                                {renderLocationValue(selectedGeneralSubmission?.fields?.['Location'])}
                                                    </dd>
                                                </div>
                                                <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                                                </svg>
                                                                Proposed line-up (and timetable)
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 whitespace-pre-wrap">{selectedGeneralSubmission?.fields?.['Proposed timetable'] || '—'}</dd>
                                                </div>
                                                
                                                {/* Comment - full width */}
                                                <div className="sm:col-span-2">
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                                </svg>
                                                                Comment
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 whitespace-pre-wrap">{selectedGeneralSubmission?.fields?.['Comment'] || '—'}</dd>
                                                </div>
                                            </dl>
                                        </div>
                                    </div>
                                )}

                                {/* Load In/Out Times Section */}
                                <div>
                                    {loadTimeSubmissions.length > 0 ? (
                                            <>
                                                {renderSubmissionDropdown(
                                                    loadTimeSubmissions,
                                                    selectedLoadTimeSubmissionId,
                                                    showLoadTimeDropdown,
                                                    setShowLoadTimeDropdown,
                                                    handleLoadTimeSubmissionChange
                                                )}
                                                <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow p-6">
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-gray-gray800 dark:text-gray-gray100">Load In/Out Times</h3>
                                            {(() => {
                                                                const loadTimeApproval = selectedLoadTimeSubmission?.fields?.['Load Time Approval'];
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
                                                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                                                {(() => {
                                                    // Calculate load times from event record if submission fields are empty
                                                    const doorsOpenStr = event?.fields?.[fieldMappings.startDateField];
                                                    const endStr = event?.fields?.[fieldMappings.endDateField];
                                                    const doorsOpen = doorsOpenStr ? parseDate(doorsOpenStr) : null;
                                                    const end = endStr ? parseDate(endStr) : null;

                                                            // Get submission field values (original/proposed)
                                                            const loadInStartSubmission = selectedLoadTimeSubmission?.fields?.['Proposed production load in start'];
                                                            const loadInEndSubmission = selectedLoadTimeSubmission?.fields?.['Proposed production load in end'];
                                                            const loadOutStartSubmission = selectedLoadTimeSubmission?.fields?.['Proposed production load out start'];
                                                            const loadOutEndSubmission = selectedLoadTimeSubmission?.fields?.['Proposed production load out end'];

                                                            // Get suggested values (Lofi fields)
                                                            const loadTimeApproval = selectedLoadTimeSubmission?.fields?.['Load Time Approval'];
                                                            const showSuggestions = loadTimeApproval === 'Rejected - Other Suggestion';
                                                            const suggestedLoadInStart = selectedLoadTimeSubmission?.fields?.['Lofi production load in start'];
                                                            const suggestedLoadInEnd = selectedLoadTimeSubmission?.fields?.['Lofi production load in end'];
                                                            const suggestedLoadOutStart = selectedLoadTimeSubmission?.fields?.['Lofi production load out start'];
                                                            const suggestedLoadOutEnd = selectedLoadTimeSubmission?.fields?.['Lofi production load out end'];

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
                                                                        <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                            </svg>
                                                                            Load In Start
                                                                        </dt>
                                                                        <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">
                                                                            {showSuggestions && suggestedLoadInStart ? (
                                                                                <div className="space-y-1">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-gray-gray600 dark:text-gray-gray400">Original:</span>
                                                                                        <span>{loadInStart ? formatDate(loadInStart) : '—'}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-blue-blue font-medium">Suggested:</span>
                                                                                        <span className="text-blue-blue font-bold">{formatDate(suggestedLoadInStart)}</span>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                loadInStart ? formatDate(loadInStart) : '—'
                                                                            )}
                                                                        </dd>
                                                            </div>
                                                            <div>
                                                                        <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                            </svg>
                                                                            Load In End
                                                                        </dt>
                                                                        <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">
                                                                            {showSuggestions && suggestedLoadInEnd ? (
                                                                                <div className="space-y-1">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-gray-gray600 dark:text-gray-gray400">Original:</span>
                                                                                        <span>{loadInEnd ? formatDate(loadInEnd) : '—'}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-blue-blue font-medium">Suggested:</span>
                                                                                        <span className="text-blue-blue font-bold">{formatDate(suggestedLoadInEnd)}</span>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                loadInEnd ? formatDate(loadInEnd) : '—'
                                                                            )}
                                                                        </dd>
                                                            </div>
                                                            <div>
                                                                        <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                            </svg>
                                                                            Load Out Start
                                                                        </dt>
                                                                        <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">
                                                                            {showSuggestions && suggestedLoadOutStart ? (
                                                                                <div className="space-y-1">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-gray-gray600 dark:text-gray-gray400">Original:</span>
                                                                                        <span>{loadOutStart ? formatDate(loadOutStart) : '—'}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-blue-blue font-medium">Suggested:</span>
                                                                                        <span className="text-blue-blue font-bold">{formatDate(suggestedLoadOutStart)}</span>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                loadOutStart ? formatDate(loadOutStart) : '—'
                                                                            )}
                                                                        </dd>
                                                            </div>
                                                            <div>
                                                                        <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1 flex items-center gap-1.5">
                                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                            </svg>
                                                                            Load Out End
                                                                        </dt>
                                                                        <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">
                                                                            {showSuggestions && suggestedLoadOutEnd ? (
                                                                                <div className="space-y-1">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-gray-gray600 dark:text-gray-gray400">Original:</span>
                                                                                        <span>{loadOutEnd ? formatDate(loadOutEnd) : '—'}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-blue-blue font-medium">Suggested:</span>
                                                                                        <span className="text-blue-blue font-bold">{formatDate(suggestedLoadOutEnd)}</span>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                loadOutEnd ? formatDate(loadOutEnd) : '—'
                                                                            )}
                                                                        </dd>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </dl>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-gray-gray800 dark:text-gray-gray100">Load In/Out Times</h3>
                        </div>
                                    <p className="text-sm text-gray-gray600 dark:text-gray-gray400">No need for Load times</p>
                    </div>
                )}
            </div>
                </>
            )}
        </div>
    )}

            <EPSubmissionModal
                open={showEPModal}
                onClose={() => {
                    setShowEPModal(false);
                    setIsNewSubmission(false);
                }}
                event={event}
                fieldMappings={fieldMappings}
                onSuccess={handleEPSubmissionSuccess}
                hideLoadTimes={isNewSubmission}
            />
            </div>
        </div>
    );
}

