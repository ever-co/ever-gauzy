import { HttpErrorResponse } from '@angular/common/http';

/** The message of an API error as the API wrote it (Nest's `message`, or the contract's `error.message`), else a generic one. */
export function errorText(error: unknown): string {
	const response = error as Partial<HttpErrorResponse> | null | undefined;
	const body = response?.error as { message?: unknown; error?: { message?: unknown } } | string | null | undefined;
	const message = typeof body === 'string' ? body : (body?.message ?? body?.error?.message);
	if (Array.isArray(message)) return message.filter((part) => typeof part === 'string').join(' ');
	if (typeof message === 'string' && message.trim()) return message.trim();
	return 'The request failed. Please try again.';
}

/** Whether an API error is a 404 (a route this installation does not serve). */
export function isNotFound(error: unknown): boolean {
	return (error as Partial<HttpErrorResponse> | null | undefined)?.status === 404;
}

/** The section map the form holds (every section, blank where the section's name decides) → what the API stores. */
export function sectionMapOf(entries: ReadonlyArray<{ gid: string; status: string }>): Record<string, string> {
	const map: Record<string, string> = {};
	for (const entry of entries) {
		const status = entry.status.trim();
		if (entry.gid && status) map[entry.gid] = status;
	}
	return map;
}

/** The code of an API error (`ASANA_CONFLICT_STALE`, …) when the API gave one. */
export function errorCode(error: unknown): string | null {
	const body = (error as Partial<HttpErrorResponse> | null | undefined)?.error as { code?: unknown; error?: { code?: unknown } } | string | null | undefined;
	if (!body || typeof body !== 'object') return null;
	const code = body.code ?? body.error?.code;
	return typeof code === 'string' && code ? code : null;
}

/** How much of a value the conflict list shows; the whole value is its tooltip. */
const CONFLICT_VALUE_MAX = 160;

/** A conflict's value as the list shows it. */
export interface ConflictValueView {
	/** The field was empty on that side. */
	empty: boolean;
	/** A due date: the ISO date-time the date pipe formats (null for any other field). */
	date: string | null;
	/**
	 * The due date names a day, not a moment (`2026-11-20`, or midnight UTC as a provider's day is stored). `date` is
	 * then the bare day (`YYYY-MM-DD`), which the date pipe reads as that day in the reader's own zone: the same day for
	 * a reader east or west of UTC.
	 */
	dateOnly: boolean;
	/** The text shown, cut to a line or two. */
	text: string;
	/** The whole text (the tooltip). */
	full: string;
}

/**
 * A stored conflict value for the list: a description (kept as the task store's sanitized HTML) as its plain text,
 * a due date as a date, anything long cut. Never HTML: the list shows text only.
 */
export function conflictValueView(field: string, value: string | null | undefined): ConflictValueView {
	const empty: ConflictValueView = { empty: true, date: null, dateOnly: false, text: '', full: '' };
	if (value === null || value === undefined) return empty;
	const raw = String(value).trim();
	if (!raw) return empty;
	if (field === 'dueDate' && !Number.isNaN(new Date(raw).getTime())) {
		const dateOnly = isDateOnly(raw);
		return { empty: false, date: dateOnly ? raw.slice(0, 10) : raw, dateOnly, text: raw, full: raw };
	}
	const full = field === 'description' ? plainText(raw) : raw;
	if (!full) return empty;
	const text = full.length > CONFLICT_VALUE_MAX ? `${full.slice(0, CONFLICT_VALUE_MAX - 1).trimEnd()}…` : full;
	return { empty: false, date: null, dateOnly: false, text, full };
}

/** Whether a stored due date names a day rather than a moment: a bare date, or exactly midnight UTC. */
export function isDateOnly(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}T00:00(?::00(?:\.0+)?)?(?:Z|[+-]00:?00)$/.test(value);
}

/** The text of an HTML fragment: block ends and line breaks become spaces, tags go, entities are read, spaces collapse. */
export function plainText(html: string): string {
	const spaced = html.replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/blockquote|\/pre)\b[^>]*>/gi, ' $&');
	const text = typeof DOMParser === 'undefined' ? spaced.replace(/<[^>]*>/g, ' ') : (new DOMParser().parseFromString(spaced, 'text/html').body.textContent ?? '');
	return text.replace(/\s+/g, ' ').trim();
}
