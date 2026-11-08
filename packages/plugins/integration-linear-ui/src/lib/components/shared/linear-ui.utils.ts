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

/** The kinds of Linear workflow state, in the order the state map lists them. */
export const LINEAR_STATE_KINDS = ['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled'] as const;
export type LinearStateKind = (typeof LINEAR_STATE_KINDS)[number];
