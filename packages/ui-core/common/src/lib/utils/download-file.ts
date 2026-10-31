import { saveAs } from 'file-saver';

/**
 * What `downloadFile` did with a link:
 *
 * - `downloaded`: the file was fetched and handed to the browser as a download;
 * - `opened`: the file's host does not allow it to be fetched from this page (no CORS), so it was opened in
 *   a new tab, where the browser shows or saves it;
 * - `unavailable`: the host answered with an error (a 404 for a file that is gone, say);
 * - `invalid`: the link is not an http(s) URL, so nothing was done.
 */
export type DownloadFileResult = 'downloaded' | 'opened' | 'unavailable' | 'invalid';

/** Characters no file system takes in a file name, and control characters. */
// eslint-disable-next-line no-control-regex
const UNSAFE_FILE_NAME_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]+/g;

/** A short extension at the end of a URL path, such as `.pdf`. */
const EXTENSION = /\.[a-z0-9]{1,8}$/i;

/**
 * `url` as an absolute http(s) URL, read against the page address, or `null` for anything else
 * (`javascript:`, `data:`, `blob:`, a blank value, text that is not a URL).
 *
 * Links that people type in (an organization document, say) are opened or fetched only after this check.
 */
export function toHttpUrl(url: unknown, base: string = globalThis.location?.href): URL | null {
	if (typeof url !== 'string' || !url.trim()) {
		return null;
	}
	try {
		const parsed = new URL(url.trim(), base);
		return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed : null;
	} catch {
		return null;
	}
}

/**
 * The name to save a download under: `name` without the characters file systems refuse, followed by the
 * extension of the URL's last path segment (`Paid Days off Request.pdf`). Falls back to that last segment,
 * then to `download`, when `name` is blank.
 */
export function downloadFileName(url: URL, name?: string): string {
	const segment = decodeURIComponentSafely(url.pathname.split('/').pop() ?? '');
	const extension = segment.match(EXTENSION)?.[0] ?? '';
	const base = (name ?? '').replace(UNSAFE_FILE_NAME_CHARACTERS, ' ').replace(/\s+/g, ' ').trim();

	if (base) {
		return base.toLowerCase().endsWith(extension.toLowerCase()) ? base : `${base}${extension}`;
	}
	return segment.replace(UNSAFE_FILE_NAME_CHARACTERS, ' ').trim() || 'download';
}

/**
 * Downloads the file at `url` under `name` (see `downloadFileName`).
 *
 * The file is fetched without cookies or a referrer, and never through Angular's `HttpClient`, whose
 * interceptors would send the signed-in user's token to whatever host the link names. When the host does
 * not allow the fetch, the link opens in a new tab without access to this page (`noopener,noreferrer`).
 *
 * @returns What was done, for the caller to tell the user when the file could not be had.
 */
export async function downloadFile(url: string, name?: string): Promise<DownloadFileResult> {
	const target = toHttpUrl(url);
	if (!target) {
		return 'invalid';
	}

	let response: Response;
	try {
		response = await fetch(target.href, { credentials: 'omit', referrerPolicy: 'no-referrer' });
	} catch {
		// A cross-origin host without CORS headers (or no network): let the browser open it instead.
		window.open(target.href, '_blank', 'noopener,noreferrer');
		return 'opened';
	}

	if (!response.ok) {
		return 'unavailable';
	}
	saveAs(await response.blob(), downloadFileName(target, name));
	return 'downloaded';
}

function decodeURIComponentSafely(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
