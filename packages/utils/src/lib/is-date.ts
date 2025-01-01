/**
 * Determines whether a value is a valid Date object or a valid date string.
 *
 * @param value - The value to check.
 * @returns {boolean} - True if the value is a valid Date, otherwise false.
 */
export function isDate(value: unknown): boolean {
    if (value instanceof Date) {
        return !Number.isNaN(value.getTime());
    }

    if (typeof value === 'string' || typeof value === 'number') {
        const parsedDate = new Date(value);
        return !Number.isNaN(parsedDate.getTime());
    }

    return false;
}
