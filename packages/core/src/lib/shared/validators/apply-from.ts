/**
 * The day a rate change applies from: a date (`2026-10-01`, UTC midnight) or a date-time with its offset
 * (`Z`, `+01:00`). A date-time without one would be read in the server's own time zone.
 */
export const APPLY_FROM_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;
