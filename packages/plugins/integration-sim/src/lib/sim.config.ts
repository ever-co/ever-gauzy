/** SIM default base URL (can be overridden per tenant) */
export const SIM_DEFAULT_BASE_URL = process.env['SIM_DEFAULT_BASE_URL'] || 'https://www.sim.ai';

/** Default workflow execution timeout (ms) */
export const SIM_DEFAULT_TIMEOUT = 30000;

/** Maximum workflow execution timeout (ms) */
export const SIM_MAX_TIMEOUT = 300000; // 5 minutes
