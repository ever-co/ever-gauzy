import { readNonNegativeIntEnv } from './bootstrap/strict-int-env';

/**
 * How long (seconds) a browser may reuse a file served from `/public/` without asking again.
 *
 * The files there — avatars, logos, screenshots, attachments — are written once under a generated name
 * and served unauthenticated; nothing told browsers they could be kept, so every page load revalidated
 * each of them (a request and a 304 per image). `PUBLIC_ASSETS_MAX_AGE_SECONDS` sets the `max-age`;
 * `0` returns to revalidating every time. Validation (ETag / Last-Modified) stays on either way.
 */
export const DEFAULT_PUBLIC_ASSETS_MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * Reads `PUBLIC_ASSETS_MAX_AGE_SECONDS`, in seconds; unset or invalid yields the default (one day).
 *
 * @param env - The process environment.
 * @param logger - Where an invalid value is reported.
 */
export function resolvePublicAssetsMaxAgeSeconds(
	env: NodeJS.ProcessEnv,
	logger: { warn: (message: string) => void } = console
): number {
	return readNonNegativeIntEnv(
		'PUBLIC_ASSETS_MAX_AGE_SECONDS',
		env.PUBLIC_ASSETS_MAX_AGE_SECONDS,
		DEFAULT_PUBLIC_ASSETS_MAX_AGE_SECONDS,
		logger
	);
}
