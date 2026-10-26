/** The values of `API_CALL_LOG_ENABLED` that turn the API call log off; anything else (and unset) leaves it on. */
const OFF_VALUES = new Set(['false', '0', 'no', 'off']);

/**
 * Whether `ApiCallLogMiddleware` records the time-tracking write routes it is mounted on (timer, time log,
 * time slot, screenshot, activity bulk): one row per call, with the request and response bodies.
 *
 * On by default, as it always was. `API_CALL_LOG_ENABLED=false` lets a deployment switch the recording off —
 * those routes are the busiest writes the desktop and agent trackers make, and each recorded call is an
 * extra insert and the bodies' storage — without losing the module, its routes or its data.
 *
 * @param env - The process environment.
 */
export function resolveApiCallLogEnabled(env: NodeJS.ProcessEnv): boolean {
	return !OFF_VALUES.has(
		String(env.API_CALL_LOG_ENABLED ?? '')
			.trim()
			.toLowerCase()
	);
}
