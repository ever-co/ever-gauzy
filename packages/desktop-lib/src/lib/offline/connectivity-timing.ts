/** How soon, at worst, the timer notices that it lost its connection to the API (#8415 asks for 30 seconds). */
export const CONNECTIVITY_DETECTION_BUDGET_MS = 30 * 1000;

/** The time between two connectivity probes of the API. */
export const CONNECTIVITY_PING_INTERVAL_MS = 10 * 1000;

/**
 * How long one probe of the API may take before the API counts as unreachable: what the detection budget leaves after
 * the time between probes, so a connection lost right after a probe is noticed by the end of the next one.
 */
export const API_PROBE_TIMEOUT_MS = CONNECTIVITY_DETECTION_BUDGET_MS - CONNECTIVITY_PING_INTERVAL_MS;
