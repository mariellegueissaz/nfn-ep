import React, {useState} from 'react';
import { useNavigate } from 'react-router-dom';
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

/**
 * Determines the status badge and button configuration based on promoter contract status and submission existence
 * @param {string} promoterContractStatus - The value of the "Promoter contract status" field
 * @param {boolean} submissionExists - Whether at least one submission is linked to the event
 * @returns {Object} - { badgeText, badgeColor, buttonLabel, messageText } or null for no badge/button
 */
function getEventStatusConfig(promoterContractStatus, submissionExists) {
    const status = promoterContractStatus?.trim() || '';
    
    // IF Promoter contract status = "Event in Creation"
    if (status === 'Event in Creation') {
        return {
            badgeText: 'Info not required yet',
            badgeColor: 'gray',
            buttonLabel: null,
            messageText: null
        };
    }
    
    // IF Promoter contract status = "Info Requested" AND Submission exists = false
    if (status === 'Info Requested' && !submissionExists) {
        return {
            badgeText: 'Info required',
            badgeColor: 'orange',
            buttonLabel: 'Provide info',
            messageText: 'Action required: Please provide missing information'
        };
    }
    
    // IF Promoter contract status = "Info Requested" AND Submission exists = true
    if (status === 'Info Requested' && submissionExists) {
        return {
            badgeText: 'In review',
            badgeColor: 'blue',
            buttonLabel: 'View submission',
            messageText: null
        };
    }
    
    // IF Promoter contract status = "Info in Review"
    if (status === 'Info in Review') {
        return {
            badgeText: 'In review',
            badgeColor: 'blue',
            buttonLabel: 'View submission',
            messageText: null
        };
    }
    
    // IF Promoter contract status = "Ready for Contracting"
    if (status === 'Ready for Contracting') {
        return {
            badgeText: 'Confirmed',
            badgeColor: 'green',
            buttonLabel: 'View details',
            messageText: null
        };
    }
    
    // IF Promoter contract status = "Draft in Review"
    if (status === 'Draft in Review') {
        return {
            badgeText: 'Confirmed',
            badgeColor: 'green',
            buttonLabel: 'View details',
            messageText: null
        };
    }
    
    // IF Promoter contract status = "Sent for Signatures"
    if (status === 'Sent for Signatures') {
        return {
            badgeText: 'Confirmed',
            badgeColor: 'green',
            buttonLabel: 'View details',
            messageText: null
        };
    }
    
    // IF Promoter contract status = "Signed"
    if (status === 'Signed') {
        return {
            badgeText: 'Confirmed',
            badgeColor: 'green',
            buttonLabel: 'View details',
            messageText: null
        };
    }
    
    // IF Promoter contract status = "Cancelled" AND Submission exists = true
    if (status === 'Cancelled' && submissionExists) {
        return {
            badgeText: 'Cancelled',
            badgeColor: 'red',
            buttonLabel: 'View details',
            messageText: null
        };
    }
    
    // IF Promoter contract status = "Cancelled" AND Submission exists = false
    if (status === 'Cancelled' && !submissionExists) {
        return {
            badgeText: 'Cancelled',
            badgeColor: 'red',
            buttonLabel: null,
            messageText: null
        };
    }
    
    // Fallback: no badge and no button
    return null;
}

// Badge color classes for status badges
const badgeColorClasses = {
    gray: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
};

export default function EventsList({records, loading, error, fieldMappings, currentUserEmail}) {
    const navigate = useNavigate();
    const [expandedIds, setExpandedIds] = useState(new Set());
    const toggle = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    if (loading) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-gray600 dark:text-gray-gray300">Loading Events</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-4">
                <div className="max-w-2xl w-full bg-white dark:bg-gray-gray700 rounded-lg shadow-xl p-8">
                    <p className="text-red-red">{error}</p>
                </div>
            </div>
        );
    }

    const now = new Date();
    const toDate = parseDate;
    const startKey = fieldMappings.startDateField;
    const endKey = fieldMappings.endDateField;
    const nameKey = fieldMappings.eventNameField;

    console.log('[EventsList] Total records received:', records.length);
    console.log('[EventsList] All records:', records);

    const normalized = records.map(r => ({
        id: r.id,
        start: toDate(r.fields?.[startKey]),
        end: toDate(r.fields?.[endKey]),
        name: r.fields?.[nameKey] || r.fields?.Name || 'Untitled Event'
    }));

    console.log('[EventsList] Normalized events:', normalized.map(e => ({
        id: e.id,
        name: e.name,
        start: e.start,
        startRaw: records.find(r => r.id === e.id)?.fields?.[startKey],
        hasStart: !!e.start
    })));

    const sorted = normalized.sort((a, b) => {
        if (!a.start && !b.start) return 0;
        if (!a.start) return 1;
        if (!b.start) return -1;
        return a.start - b.start;
    });

    const upcoming = sorted.filter(r => r.start && r.start >= now);
    const past = sorted.filter(r => r.start && r.start < now);
    const noDate = sorted.filter(r => !r.start);

    console.log('[EventsList] Filtered events:', {
        upcoming: upcoming.length,
        past: past.length,
        noDate: noDate.length,
        upcomingIds: upcoming.map(e => e.id),
        pastIds: past.map(e => e.id),
        noDateIds: noDate.map(e => e.id),
        now: now.toISOString()
    });

    return (
        <div className="max-w-4xl mx-auto">
            {records.length === 0 ? (
                <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow p-8 text-center">
                    <h3 className="text-lg font-medium text-gray-gray800 dark:text-gray-gray100 mb-2">No events found</h3>
                    <p className="text-gray-gray600 dark:text-gray-gray300">No events associated with your email</p>
                </div>
            ) : (
                <div className="space-y-8">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-gray800 dark:text-gray-gray100 mb-4">Upcoming Events</h2>
                        {upcoming.length > 0 ? (
                            <ul className="bg-white dark:bg-gray-gray700 rounded-lg shadow divide-y divide-gray-gray100 dark:divide-gray-gray600">
                                {upcoming.map(item => {
                                    const isOpen = expandedIds.has(item.id);
                                    const dateRange = `${formatDate(item.start)}${item.end ? ` - ${formatDate(item.end)}` : ''}`;
                                    const record = records.find(r => r.id === item.id);
                                    const epSubmissionLinkField = import.meta.env.VITE_EP_SUBMISSION_LINK_FIELD || 'EP Submission';
                                    const epSubmission = record?.fields?.[epSubmissionLinkField];
                                    const hasSubmission = epSubmission && (Array.isArray(epSubmission) ? epSubmission.length > 0 : true);
                                    
                                    // Get promoter contract status
                                    const promoterContractStatusField = 'Promoter contract status';
                                    const promoterContractStatus = record?.fields?.[promoterContractStatusField];
                                    
                                    // Get status configuration
                                    const statusConfig = getEventStatusConfig(promoterContractStatus, hasSubmission);
                                    
                                    return (
                                        <li key={item.id} className={`px-4 py-4 ${isOpen ? 'bg-gray-50 dark:bg-gray-gray800' : ''}`}>
                                            <div className={`flex items-center gap-2 ${isOpen ? 'bg-gray-50 dark:bg-gray-gray800 -mx-4 px-4 py-3' : ''}`}>
                                                <button type="button" onClick={() => toggle(item.id)} className="flex-1 text-left">
                                                    <div className="flex items-center gap-3">
                                                        <svg className={`w-5 h-5 text-gray-gray400 dark:text-gray-gray500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                                        </svg>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="font-medium text-gray-gray800 dark:text-gray-gray100 truncate">{item.name}</p>
                                                            </div>
                                                            <p className="text-sm text-gray-gray500 dark:text-gray-gray400 mt-1 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5 text-gray-gray400 dark:text-gray-gray500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                {dateRange}
                                                            </p>
                                                            {statusConfig && (
                                                                <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-xs font-medium ${badgeColorClasses[statusConfig.badgeColor]}`}>
                                                                    {statusConfig.badgeText}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                                {statusConfig?.buttonLabel && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/events/${item.id}`);
                                                        }}
                                                        className={`px-3 py-1.5 rounded-md transition-colors text-sm font-medium flex-shrink-0 min-w-[140px] ${
                                                            statusConfig.buttonLabel === 'Provide info'
                                                                ? 'bg-blue-blue text-white hover:bg-opacity-90'
                                                                : 'bg-white dark:bg-gray-gray700 border-2 border-gray-gray300 dark:border-gray-gray600 text-gray-gray800 dark:text-gray-gray100 hover:bg-gray-gray50 dark:hover:bg-gray-gray600'
                                                        }`}
                                                    >
                                                        {statusConfig.buttonLabel}
                                                    </button>
                                                )}
                                            </div>
                                            {isOpen && (
                                                <div className="mt-3 pl-8">
                                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8">
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                Start
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.startDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                End
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.endDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                Proposed Announcement Date
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDateOnly(records.find(r => r.id === item.id)?.fields?.[fieldMappings.proposedAnnouncementDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                Proposed Ticket on Sale Date
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDateOnly(records.find(r => r.id === item.id)?.fields?.[fieldMappings.publicTicketReleaseDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                </svg>
                                                                Location
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">
                                                                {renderLocationValue(records.find(r => r.id === item.id)?.fields?.[fieldMappings.locationField])}
                                                            </dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                                                </svg>
                                                                Proposed line-up (and timetable)
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1 whitespace-pre-wrap">{records.find(r => r.id === item.id)?.fields?.[fieldMappings.proposedLineupField] || '—'}</dd>
                                                        </div>
                                                    </dl>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow p-6 text-center">
                                <p className="text-gray-gray500 dark:text-gray-gray400">No upcoming events</p>
                            </div>
                        )}
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold text-gray-gray800 dark:text-gray-gray100 mb-4">Past Events</h2>
                        {past.length > 0 ? (
                            <ul className="bg-white dark:bg-gray-gray700 rounded-lg shadow divide-y divide-gray-gray100 dark:divide-gray-gray600">
                                {past.map(item => {
                                    const isOpen = expandedIds.has(item.id);
                                    const dateRange = `${formatDate(item.start)}${item.end ? ` - ${formatDate(item.end)}` : ''}`;
                                    const record = records.find(r => r.id === item.id);
                                    const epSubmissionLinkField = import.meta.env.VITE_EP_SUBMISSION_LINK_FIELD || 'EP Submission';
                                    const epSubmission = record?.fields?.[epSubmissionLinkField];
                                    const hasSubmission = epSubmission && (Array.isArray(epSubmission) ? epSubmission.length > 0 : true);
                                    
                                    // Get promoter contract status
                                    const promoterContractStatusField = 'Promoter contract status';
                                    const promoterContractStatus = record?.fields?.[promoterContractStatusField];
                                    
                                    // Get status configuration
                                    const statusConfig = getEventStatusConfig(promoterContractStatus, hasSubmission);
                                    
                                    return (
                                        <li key={item.id} className={`px-4 py-4 ${isOpen ? 'bg-gray-50 dark:bg-gray-gray800' : ''}`}>
                                            <div className={`flex items-center gap-2 ${isOpen ? 'bg-gray-50 dark:bg-gray-gray800 -mx-4 px-4 py-3' : ''}`}>
                                                <button type="button" onClick={() => toggle(item.id)} className="flex-1 text-left">
                                                    <div className="flex items-center gap-3">
                                                        <svg className={`w-5 h-5 text-gray-gray400 dark:text-gray-gray500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                                        </svg>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="font-medium text-gray-gray800 dark:text-gray-gray100 truncate">{item.name}</p>
                                                            </div>
                                                            <p className="text-sm text-gray-gray500 dark:text-gray-gray400 mt-1 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5 text-gray-gray400 dark:text-gray-gray500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                {dateRange}
                                                            </p>
                                                            {statusConfig && (
                                                                <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-xs font-medium ${badgeColorClasses[statusConfig.badgeColor]}`}>
                                                                    {statusConfig.badgeText}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                                {statusConfig?.buttonLabel && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/events/${item.id}`);
                                                        }}
                                                        className={`px-3 py-1.5 rounded-md transition-colors text-sm font-medium flex-shrink-0 min-w-[140px] ${
                                                            statusConfig.buttonLabel === 'Provide info'
                                                                ? 'bg-blue-blue text-white hover:bg-opacity-90'
                                                                : 'bg-white dark:bg-gray-gray700 border-2 border-gray-gray300 dark:border-gray-gray600 text-gray-gray800 dark:text-gray-gray100 hover:bg-gray-gray50 dark:hover:bg-gray-gray600'
                                                        }`}
                                                    >
                                                        {statusConfig.buttonLabel}
                                                    </button>
                                                )}
                                            </div>
                                            {isOpen && (
                                                <div className="mt-3 pl-8">
                                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8">
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                Start
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.startDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                End
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.endDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                Proposed Announcement Date
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDateOnly(records.find(r => r.id === item.id)?.fields?.[fieldMappings.proposedAnnouncementDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                Proposed Ticket on Sale Date
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDateOnly(records.find(r => r.id === item.id)?.fields?.[fieldMappings.publicTicketReleaseDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                </svg>
                                                                Location
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">
                                                                {renderLocationValue(records.find(r => r.id === item.id)?.fields?.[fieldMappings.locationField])}
                                                            </dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                                                </svg>
                                                                Proposed line-up (and timetable)
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1 whitespace-pre-wrap">{records.find(r => r.id === item.id)?.fields?.[fieldMappings.proposedLineupField] || '—'}</dd>
                                                        </div>
                                                    </dl>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow p-6 text-center">
                                <p className="text-gray-gray500 dark:text-gray-gray400">No past events</p>
                            </div>
                        )}
                    </div>

                    {noDate.length > 0 && (
                        <div>
                            <h2 className="text-xl font-semibold text-gray-gray800 dark:text-gray-gray100 mb-4">Events Without Date</h2>
                            <ul className="bg-white dark:bg-gray-gray700 rounded-lg shadow divide-y divide-gray-gray100 dark:divide-gray-gray600">
                                {noDate.map(item => {
                                    const isOpen = expandedIds.has(item.id);
                                    const record = records.find(r => r.id === item.id);
                                    const epSubmissionLinkField = import.meta.env.VITE_EP_SUBMISSION_LINK_FIELD || 'EP Submission';
                                    const epSubmission = record?.fields?.[epSubmissionLinkField];
                                    const hasSubmission = epSubmission && (Array.isArray(epSubmission) ? epSubmission.length > 0 : true);
                                    
                                    // Get promoter contract status
                                    const promoterContractStatusField = 'Promoter contract status';
                                    const promoterContractStatus = record?.fields?.[promoterContractStatusField];
                                    
                                    // Get status configuration
                                    const statusConfig = getEventStatusConfig(promoterContractStatus, hasSubmission);
                                    
                                    return (
                                        <li key={item.id} className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <button type="button" onClick={() => toggle(item.id)} className="flex-1 text-left">
                                                    <div className="flex items-center gap-3">
                                                        <svg className={`w-5 h-5 text-gray-gray400 dark:text-gray-gray500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                                        </svg>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-gray-gray800 dark:text-gray-gray100 truncate">{item.name}</p>
                                                            <p className="text-sm text-gray-gray500 dark:text-gray-gray400 mt-1 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5 text-gray-gray400 dark:text-gray-gray500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                No date set
                                                            </p>
                                                            {statusConfig && (
                                                                <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-xs font-medium ${badgeColorClasses[statusConfig.badgeColor]}`}>
                                                                    {statusConfig.badgeText}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                                {statusConfig?.buttonLabel && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/events/${item.id}`);
                                                        }}
                                                        className={`px-3 py-1.5 rounded-md transition-colors text-sm font-medium flex-shrink-0 min-w-[140px] ${
                                                            statusConfig.buttonLabel === 'Provide info'
                                                                ? 'bg-blue-blue text-white hover:bg-opacity-90'
                                                                : 'bg-white dark:bg-gray-gray700 border-2 border-gray-gray300 dark:border-gray-gray600 text-gray-gray800 dark:text-gray-gray100 hover:bg-gray-gray50 dark:hover:bg-gray-gray600'
                                                        }`}
                                                    >
                                                        {statusConfig.buttonLabel}
                                                    </button>
                                                )}
                                            </div>
                                            {isOpen && (
                                                <div className="mt-3 pl-2 border-l border-gray-gray200 dark:border-gray-gray600">
                                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                Start
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.startDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                End
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.endDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                Proposed Announcement Date
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDateOnly(records.find(r => r.id === item.id)?.fields?.[fieldMappings.proposedAnnouncementDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                Proposed Ticket on Sale Date
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDateOnly(records.find(r => r.id === item.id)?.fields?.[fieldMappings.publicTicketReleaseDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                </svg>
                                                                Location
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">
                                                                {renderLocationValue(records.find(r => r.id === item.id)?.fields?.[fieldMappings.locationField])}
                                                            </dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                                                </svg>
                                                                Proposed line-up (and timetable)
                                                            </dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1 whitespace-pre-wrap">{records.find(r => r.id === item.id)?.fields?.[fieldMappings.proposedLineupField] || '—'}</dd>
                                                        </div>
                                                    </dl>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


