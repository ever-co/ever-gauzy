/** The web app page with an employee's time and activity. */
export const TIME_ACTIVITIES_PATH = '/pages/employees/activity/time-activities';

/** Whether `url` is an absolute http(s) URL: the only kind the time tracker opens in the browser. */
export function isHttpUrl(url: string | null | undefined): boolean {
	if (!url) {
		return false;
	}
	try {
		const { protocol } = new URL(url);
		return protocol === 'http:' || protocol === 'https:';
	} catch {
		return false;
	}
}

/**
 * The web app's address with its hash routing (`…/#`), without a trailing slash: `GAUZY_CLOUD_APP` already ends with
 * `/#`, a local server's web UI address (`http://127.0.0.1:4200`) does not.
 */
export function withHashRouting(url: string): string {
	const base = url.trim().replace(/\/+$/, '');
	return base.includes('#') ? base : `${base}/#`;
}

/** Whether two http(s) URLs share their origin (scheme, host and port). */
function sameOrigin(a: string | null | undefined, b: string | null | undefined): boolean {
	if (!isHttpUrl(a) || !isHttpUrl(b)) {
		return false;
	}
	return new URL(a).origin === new URL(b).origin;
}

export interface IWebAppSources {
	/** The API the time tracker works with. */
	apiHost: string | null | undefined;
	/** The web app of Gauzy Cloud (`GAUZY_CLOUD_APP`). */
	cloudAppUrl?: string | null;
	/** The web UI the app serves on this computer, while its UI server runs (from the main process). */
	localWebAppUrl?: string | null;
	/** The API of Gauzy Cloud (from the main process). Without it, no server counts as Gauzy Cloud. */
	cloudApiUrl?: string | null;
}

/**
 * Where the web app is for the server the time tracker uses (#9517), or `null` when that is not known:
 *
 * - a web UI the app serves on this computer (Gauzy Server, API Server): that one;
 * - Gauzy Cloud: `GAUZY_CLOUD_APP`;
 * - any other (custom) server: unknown. Its web app address cannot be derived from its API address, so the time
 *   tracker shows no link rather than a guessed one.
 */
export function resolveWebAppBaseUrl(sources: IWebAppSources): string | null {
	const { apiHost, cloudAppUrl, localWebAppUrl, cloudApiUrl } = sources;

	if (isHttpUrl(localWebAppUrl)) {
		return withHashRouting(localWebAppUrl);
	}
	if (sameOrigin(apiHost, cloudApiUrl) && isHttpUrl(cloudAppUrl)) {
		return withHashRouting(cloudAppUrl);
	}
	return null;
}

/** `date` as `YYYY-MM-DD` in the local time zone (the day the user sees on their clock). */
export function toLocalIsoDate(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface ITimeActivitiesLink {
	organizationId: string | null | undefined;
	employeeId: string | null | undefined;
	/** The day to show. */
	date: Date;
}

/**
 * The web app page with the employee's time and activity of one day, as the owner specified it on #9517:
 * `<web app>/#/pages/employees/activity/time-activities?organizationId=…&date=…&date_end=…&unit_of_time=day&employeeId=…&is_custom_date=false`.
 * `null` when the web app is unknown, not an http(s) address, or the organization or employee is missing.
 */
export function buildTimeActivitiesUrl(baseUrl: string | null | undefined, link: ITimeActivitiesLink): string | null {
	const { organizationId, employeeId, date } = link;
	if (!isHttpUrl(baseUrl) || !organizationId || !employeeId) {
		return null;
	}

	const day = toLocalIsoDate(date);
	const query = new URLSearchParams({
		organizationId,
		date: day,
		date_end: day,
		unit_of_time: 'day',
		employeeId,
		is_custom_date: 'false'
	});
	return `${withHashRouting(baseUrl)}${TIME_ACTIVITIES_PATH}?${query.toString()}`;
}
