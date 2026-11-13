/**
 * The most timesheets one submit or status request may name. A weekly timesheet per member keeps a real bulk
 * selection far below this; it only stops a body from putting an unbounded list into the `IN (...)` filter.
 */
export const MAX_TIMESHEET_STATUS_IDS = 500;
