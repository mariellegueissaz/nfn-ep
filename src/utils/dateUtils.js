/**
 * Parses a date string in DD/MM/YYYY HH:mm format (or D/MM/YYYY HH:mm)
 * Falls back to standard Date parsing if the format doesn't match
 * @param {string|Date} v - Date string or Date object
 * @returns {Date|null} Parsed Date object or null if invalid
 */
export function parseDate(v) {
    if (!v) return null;
    if (v instanceof Date) {
        return isNaN(v.getTime()) ? null : v;
    }
    
    const dateStr = String(v).trim();
    
    // Handle DD/MM/YYYY HH:mm format (e.g., "16/10/2027 21:00")
    // Also handle D/MM/YYYY HH:mm format (e.g., "5/10/2027 00:00")
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (match) {
        const [, day, month, year, hours = '0', minutes = '0'] = match;
        // Create date in YYYY-MM-DD format to avoid ambiguity
        const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
        const date = new Date(isoStr);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    
    // Fallback to standard Date parsing
    const date = new Date(v);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a Date object or ISO string to DD/MM/YYYY HH:mm format
 * @param {Date|string} iso - Date object or ISO string
 * @returns {string} Formatted date string or empty string if invalid
 */
export function formatDate(iso) {
    if (!iso) return '';
    const date = iso instanceof Date ? iso : parseDate(iso);
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

