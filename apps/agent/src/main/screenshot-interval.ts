/**
 * Where the agent's screenshot interval comes from.
 *
 * The organisation configures the screenshot frequency (in minutes) on its timer settings. The desktop timer reads it
 * from the signed-in user's employee organisation (`/api/user/me` with the employee and its organisation) and stores it
 * as the local `timer.updatePeriod`, which its capture schedule reads. It does that only when the organisation turned
 * `enforced` on, because `enforced` is what stops an employee from overriding the organisation's choice with their own
 * period in the timer's settings page. The agent never offers that choice (its settings page keeps the period selector
 * disabled), so for the agent the organisation's frequency always applies, whatever `enforced` says. The agent used to
 * skip the organisation entirely and capture on its local default.
 */

/** Interval used when neither the organisation nor the local settings carry a usable value (minutes) */
export const DEFAULT_SCREENSHOT_INTERVAL_MINUTES = 5;

/** The organisation timer settings the agent applies */
export type TOrganizationScreenshotSetting = {
	/** Minutes between screenshots. A `numeric` column, so Postgres hands it over as a string ("10") */
	screenshotFrequency?: number | string | null;
};

/**
 * A screenshot frequency in minutes, or `null` when it is unset or unusable (missing, not a number, zero or negative).
 */
export function parseScreenshotFrequency(value: unknown): number | null {
	const minutes = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
	return typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

/**
 * The organisation's screenshot frequency to store as the local `timer.updatePeriod`, or `null` to keep the current
 * value when the organisation has none.
 */
export function organizationScreenshotPeriod(
	organization: TOrganizationScreenshotSetting | null | undefined
): number | null {
	return parseScreenshotFrequency(organization?.screenshotFrequency);
}

/**
 * The capture interval in seconds: the stored `timer.updatePeriod` (the organisation's frequency once the agent has
 * read it), else the default.
 */
export function resolveScreenshotIntervalSeconds(
	appSetting: { timer?: { updatePeriod?: number | string | null } } | null | undefined
): number {
	const minutes = parseScreenshotFrequency(appSetting?.timer?.updatePeriod) ?? DEFAULT_SCREENSHOT_INTERVAL_MINUTES;
	return Math.round(minutes * 60);
}
