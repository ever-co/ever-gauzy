/**
 * Opening links that people type in (an organization document, a time-off request's document) only when they are
 * http(s), and without handing the opened page a way back into this one.
 */

/** What `openInNewTab` did with a link. */
export type OpenInNewTabResult = 'opened' | 'blocked' | 'invalid';

/**
 * `url` as an absolute http(s) URL, read against the page address, or `null` for anything else
 * (`javascript:`, `data:`, `blob:`, a blank value, text that is not a URL).
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
 * Opens an http(s) link in a new tab that has no access to this page (its `opener` is cut before it navigates).
 *
 * The tab is opened blank first and pointed at the link afterwards, so the browser's answer is visible: when it
 * blocks the tab (a popup opened after an `await` has outlived the click that allowed it), this says `blocked`, and
 * the caller can offer a link the user clicks instead.
 *
 * @returns `opened`; `blocked` when the browser refused the tab; `invalid` when the link is not http(s) (nothing is
 * opened then).
 */
export function openInNewTab(url: string): OpenInNewTabResult {
	const target = toHttpUrl(url);
	if (!target) {
		return 'invalid';
	}
	const tab = window.open('', '_blank');
	if (!tab) {
		return 'blocked';
	}
	tab.opener = null;
	tab.location.href = target.href;
	return 'opened';
}

/** `value` safe inside a double-quoted HTML attribute or as HTML text. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}
