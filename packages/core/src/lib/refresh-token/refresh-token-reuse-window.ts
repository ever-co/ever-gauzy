/** The reuse window when `JWT_REFRESH_TOKEN_REUSE_WINDOW` is not set, in seconds. */
export const DEFAULT_REFRESH_TOKEN_REUSE_WINDOW_S = 10;

/** The longest reuse window a deployment can set, in seconds: a longer one is cut to this. */
export const MAX_REFRESH_TOKEN_REUSE_WINDOW_S = 60;

/**
 * How long a refresh token that was just rotated is still answered when it is presented again, in milliseconds
 * (see `token/shared/rotation-reuse.ts`).
 *
 * The window is a trade: it keeps the session of a client whose answer was lost, or that sent the same token twice
 * at once, and for that long a refresh token someone copied still works after its owner renewed it. So it is short,
 * it has a ceiling, and `0` turns it off (each refresh token is then accepted once, as before).
 *
 * @param configured The value of `JWT_REFRESH_TOKEN_REUSE_WINDOW`, in seconds.
 * @returns The window in milliseconds: the default when the value is not set or is not a number of seconds.
 */
export function refreshTokenReuseWindowMs(configured: string | number | null | undefined): number {
	const isSet = configured !== undefined && configured !== null && String(configured).trim() !== '';
	const seconds = isSet ? Number(configured) : DEFAULT_REFRESH_TOKEN_REUSE_WINDOW_S;
	if (!Number.isFinite(seconds) || seconds < 0) {
		return DEFAULT_REFRESH_TOKEN_REUSE_WINDOW_S * 1000;
	}
	return Math.min(seconds, MAX_REFRESH_TOKEN_REUSE_WINDOW_S) * 1000;
}
