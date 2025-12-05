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
                
                // Load EP Submission if linked
                const epSubmissionIds = rawRecord.fields?.[epSubmissionLinkField];
                if (epSubmissionIds && Array.isArray(epSubmissionIds) && epSubmissionIds.length > 0) {
                    // Get the first linked EP Submission record ID
                    const epSubmissionId = typeof epSubmissionIds[0] === 'object' ? epSubmissionIds[0].id : epSubmissionIds[0];
                    try {
                        setLoadingSubmission(true);
                        const epSubmissionTable = import.meta.env.VITE_EP_SUBMISSION_TABLE_NAME || import.meta.env.VITE_EP_SUBMISSION_TABLE_ID || 'EP Submission';
                        console.log('[EventDetails] Fetching EP Submission:', { table: epSubmissionTable, id: epSubmissionId });
                        const submissionRecord = await airtableApi.getRecord(epSubmissionTable, epSubmissionId, {
                            cellFormat: 'string',
                            timeZone: 'Europe/Zurich',
                            userLocale: 'en-GB'
                        });
                        setEpSubmission(submissionRecord);
                    } catch (subErr) {
                        console.error('Failed to load EP Submission:', subErr);
                        setEpSubmission(null);
                    } finally {
                        setLoadingSubmission(false);
                    }
                } else {
                    setEpSubmission(null);
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

    const handleEPSubmissionSuccess = async () => {
        // Reload event to get updated EP Submission link
        const tableName = import.meta.env.VITE_TABLE_NAME || import.meta.env.VITE_TABLE_ID;
        const epSubmissionLinkField = import.meta.env.VITE_EP_SUBMISSION_LINK_FIELD || 'EP Submission';
        
        try {
            // First, load event with raw IDs to get EP Submission record ID
            const rawRecord = await airtableApi.getRecord(tableName, eventId, { noQuery: true });
            
            // Load EP Submission if linked
            const epSubmissionIds = rawRecord.fields?.[epSubmissionLinkField];
            if (epSubmissionIds && Array.isArray(epSubmissionIds) && epSubmissionIds.length > 0) {
                // Get the first linked EP Submission record ID
                const epSubmissionId = typeof epSubmissionIds[0] === 'object' ? epSubmissionIds[0].id : epSubmissionIds[0];
                setLoadingSubmission(true);
                try {
                    const epSubmissionTable = import.meta.env.VITE_EP_SUBMISSION_TABLE_NAME || import.meta.env.VITE_EP_SUBMISSION_TABLE_ID || 'EP Submissions';
                    const submissionRecord = await airtableApi.getRecord(epSubmissionTable, epSubmissionId, {
                        cellFormat: 'string',
                        timeZone: 'Europe/Zurich',
                        userLocale: 'en-GB'
                    });
                    setEpSubmission(submissionRecord);
                } catch (subErr) {
                    console.error('Failed to load EP Submission:', subErr);
                    setEpSubmission(null);
                } finally {
                    setLoadingSubmission(false);
                }
            } else {
                setEpSubmission(null);
            }
            
            // Load event with formatted fields for display
            const record = await airtableApi.getRecord(tableName, eventId, {
                cellFormat: 'string',
                timeZone: 'Europe/Zurich',
                userLocale: 'en-GB'
            });
            setEvent(record);
        } catch (err) {
            console.error('Failed to reload event:', err);
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

                {epSubmission && (
                    <div className="mt-6">
                        {(() => {
                            const submissionDate = epSubmission.fields?.['Date'];
                            const formattedDate = submissionDate ? formatDate(submissionDate) : '';
                            const title = formattedDate ? `Submission ${formattedDate}` : 'Submission';
                            return (
                                <h2 className="text-xl font-semibold text-gray-gray800 dark:text-gray-gray100 mb-4">{title}</h2>
                            );
                        })()}
                        <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow p-6">
                            {loadingSubmission ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-8 h-8 border-4 border-blue-blue border-t-transparent rounded-full animate-spin"></div>
                                    <span className="ml-3 text-gray-gray600 dark:text-gray-gray300">Loading submission...</span>
                                </div>
                            ) : (
                                <>
                                    {/* Eventname and Approval status badge on same row */}
                                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-gray200 dark:border-gray-gray600">
                                        <div>
                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Eventname</dt>
                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{epSubmission.fields?.['Eventname'] || '—'}</dd>
                                        </div>
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
                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Start</dt>
                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{formatDate(epSubmission.fields?.['Doors open']) || '—'}</dd>
                                        </div>
                                    <div>
                                        <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">End</dt>
                                        <dd className="text-sm text-gray-gray800 dark:text-gray-gray100">{formatDate(epSubmission.fields?.['End']) || '—'}</dd>
                                    </div>
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

