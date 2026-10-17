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

/** The Ever Works page that creates an integration key with the "Ever Gauzy" preset (plan 02 §1). */
export const EVER_WORKS_NEW_KEY_PATH = '/settings/api-keys?new=integration&preset=ever-gauzy';

/** The key-creation link for an operator-configured app URL; only HTTPS addresses are linked. */
export function newKeyUrlOf(appUrl: string | null | undefined): string | null {
	return appUrl && /^https:\/\//.test(appUrl) ? `${appUrl.replace(/\/+$/, '')}${EVER_WORKS_NEW_KEY_PATH}` : null;
}
