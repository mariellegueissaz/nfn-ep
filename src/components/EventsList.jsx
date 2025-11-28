import React, {useState} from 'react';
import { useNavigate } from 'react-router-dom';
import { parseDate, formatDate } from '../utils/dateUtils.js';

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
                    <p className="text-gray-gray600 dark:text-gray-gray300">Loading...</p>
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
                                    return (
                                        <li key={item.id} className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <button type="button" onClick={() => toggle(item.id)} className="flex-1 text-left">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-gray-gray800 dark:text-gray-gray100 truncate">{item.name}</p>
                                                            <p className="text-sm text-gray-gray500 dark:text-gray-gray400 mt-1">{dateRange}</p>
                                                        </div>
                                                        <svg className={`w-5 h-5 text-gray-gray400 dark:text-gray-gray500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                                        </svg>
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/events/${item.id}`);
                                                    }}
                                                    className="px-3 py-1.5 bg-blue-blue text-white rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium flex-shrink-0"
                                                >
                                                    Open
                                                </button>
                                            </div>
                                            {isOpen && (
                                                <div className="mt-3 pl-2 border-l border-gray-gray200 dark:border-gray-gray600">
                                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Start</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.startDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">End</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.endDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Proposed Announcement Date</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.proposedAnnouncementDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Proposed Ticket on Sale Date</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.publicTicketReleaseDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Location</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">
                                                                {renderLocationValue(records.find(r => r.id === item.id)?.fields?.[fieldMappings.locationField])}
                                                            </dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Proposed line-up (and timetable)</dt>
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
                                    return (
                                        <li key={item.id} className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <button type="button" onClick={() => toggle(item.id)} className="flex-1 text-left">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-gray-gray800 dark:text-gray-gray100 truncate">{item.name}</p>
                                                            <p className="text-sm text-gray-gray500 dark:text-gray-gray400 mt-1">{dateRange}</p>
                                                        </div>
                                                        <svg className={`w-5 h-5 text-gray-gray400 dark:text-gray-gray500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                                        </svg>
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/events/${item.id}`);
                                                    }}
                                                    className="px-3 py-1.5 bg-blue-blue text-white rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium flex-shrink-0"
                                                >
                                                    Open
                                                </button>
                                            </div>
                                            {isOpen && (
                                                <div className="mt-3 pl-2 border-l border-gray-gray200 dark:border-gray-gray600">
                                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Start</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.startDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">End</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.endDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Proposed Announcement Date</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.proposedAnnouncementDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Proposed Ticket on Sale Date</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.publicTicketReleaseDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Location</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">
                                                                {renderLocationValue(records.find(r => r.id === item.id)?.fields?.[fieldMappings.locationField])}
                                                            </dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Proposed line-up (and timetable)</dt>
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
                                    return (
                                        <li key={item.id} className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <button type="button" onClick={() => toggle(item.id)} className="flex-1 text-left">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-gray-gray800 dark:text-gray-gray100 truncate">{item.name}</p>
                                                            <p className="text-sm text-gray-gray500 dark:text-gray-gray400 mt-1">No date set</p>
                                                        </div>
                                                        <svg className={`w-5 h-5 text-gray-gray400 dark:text-gray-gray500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                                        </svg>
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/events/${item.id}`);
                                                    }}
                                                    className="px-3 py-1.5 bg-blue-blue text-white rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium flex-shrink-0"
                                                >
                                                    Open
                                                </button>
                                            </div>
                                            {isOpen && (
                                                <div className="mt-3 pl-2 border-l border-gray-gray200 dark:border-gray-gray600">
                                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Start</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.startDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">End</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.endDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Proposed Announcement Date</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.proposedAnnouncementDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Proposed Ticket on Sale Date</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">{formatDate(records.find(r => r.id === item.id)?.fields?.[fieldMappings.publicTicketReleaseDateField]) || '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Location</dt>
                                                            <dd className="text-sm text-gray-gray800 dark:text-gray-gray100 mt-1">
                                                                {renderLocationValue(records.find(r => r.id === item.id)?.fields?.[fieldMappings.locationField])}
                                                            </dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs uppercase text-gray-gray500 dark:text-gray-gray400">Proposed line-up (and timetable)</dt>
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


