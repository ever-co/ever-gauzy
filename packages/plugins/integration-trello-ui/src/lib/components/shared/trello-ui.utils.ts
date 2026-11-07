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

/** The token Trello put in the URL fragment on return (`token=…`, possibly among other pairs), or null. */
export function tokenOfFragment(fragment: string | null | undefined): string | null {
	if (!fragment) return null;
	const params = new URLSearchParams(fragment.startsWith('#') ? fragment.slice(1) : fragment);
	const token = params.get('token')?.trim() ?? '';
	return /^[A-Za-z0-9]{1,256}$/.test(token) ? token : null;
}

/** The list map the form holds (every list, blank where the list's name decides) → what the API stores. */
export function listMapOf(entries: ReadonlyArray<{ id: string; status: string }>): Record<string, string> {
	const map: Record<string, string> = {};
	for (const entry of entries) {
		const status = entry.status.trim();
		if (entry.id && status) map[entry.id] = status;
	}
	return map;
}
