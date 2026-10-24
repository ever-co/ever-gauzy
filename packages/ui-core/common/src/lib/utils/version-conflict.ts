/**
 * The code the API answers a write with when the row the write was based on has moved on since it was read: the
 * compare-and-set of an optimistic version (`409 ENTITY_VERSION_CONFLICT`, catalogued in the API's
 * `api-error-codes.ts`). The body also carries `details: { id, expectedVersion, actualVersion }`.
 */
export const ENTITY_VERSION_CONFLICT = 'ENTITY_VERSION_CONFLICT';

/**
 * Whether a failed request was refused because the row it was based on changed since the page read it — another
 * user's edit or decision landed first. The page should then say so and read the row again, rather than show the
 * failure as an error of the user's own input.
 *
 * Only the catalogued code counts: other 409 answers of the API are other refusals (a request that is already
 * decided, a duplicate), and are left to the page's usual error handling.
 *
 * @param error What the HTTP call rejected with, normally an `HttpErrorResponse` (`status` and the body as `error`).
 * @returns True for a `409 ENTITY_VERSION_CONFLICT`.
 */
export function isEntityVersionConflict(error: unknown): boolean {
	const failure = error as { status?: unknown; error?: { code?: unknown } | null } | null | undefined;
	return failure?.status === 409 && failure?.error?.code === ENTITY_VERSION_CONFLICT;
}
