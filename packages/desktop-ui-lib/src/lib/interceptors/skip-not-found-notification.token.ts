import { HttpContextToken, HttpStatusCode } from '@angular/common/http';

/**
 * Set on a request whose caller takes the API's 404 for an answer (the record was deleted on the server), so
 * `ServerErrorInterceptor` does not show its generic error toast for that 404. Any other error of the request is still
 * reported, a 404 that is not the API's own (see {@link isApiNotFound}) included, and detecting that the server is down
 * is not affected.
 */
export const SKIP_NOT_FOUND_NOTIFICATION = new HttpContextToken<boolean>(() => false);

/**
 * The API answered that what was asked for does not exist: a 404 whose body is the API's own error. A 404 from
 * something in between (a proxy or load balancer answering for a route it cannot reach) says nothing about the record,
 * so it is not taken for a deletion.
 */
export function isApiNotFound(error: unknown): boolean {
	const response = error as { status?: number; error?: { statusCode?: number } | string | null } | null;
	const body = response?.error;
	return (
		response?.status === HttpStatusCode.NotFound &&
		typeof body === 'object' &&
		body?.statusCode === HttpStatusCode.NotFound
	);
}
