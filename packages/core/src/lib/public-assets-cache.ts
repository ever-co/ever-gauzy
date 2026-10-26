import { readNonNegativeIntEnv } from './bootstrap/strict-int-env';

/**
 * How long (seconds) a browser may reuse a file served from `/public/` without asking again.
 *
 * The files there — avatars, logos, screenshots, attachments — are written once under a generated name
 * and served unauthenticated; nothing told browsers they could be kept, so every page load revalidated
 * each of them (a request and a 304 per image). `PUBLIC_ASSETS_MAX_AGE_SECONDS` sets the `max-age` of a
 * browser-only (`private`) cache; `0` returns to revalidating every time. Validation (ETag / Last-Modified)
 * stays on either way.
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

/**
 * The `Cache-Control` of a file served from `/public/`, or `null` to keep serve-static's own
 * `public, max-age=0` (revalidate every time, as before `PUBLIC_ASSETS_MAX_AGE_SECONDS` existed).
 *
 * `private`, not `public`: only the viewer's browser keeps the file. A shared cache (a CDN or proxy in front
 * of the API) would otherwise go on serving a deleted screenshot or attachment, to anyone holding its URL,
 * for up to `max-age` after the origin removed it; a browser keeps only what its own user was already shown.
 *
 * @param maxAgeSeconds - From {@link resolvePublicAssetsMaxAgeSeconds}.
 */
export function publicAssetsCacheControl(maxAgeSeconds: number): string | null {
	return maxAgeSeconds > 0 ? `private, max-age=${maxAgeSeconds}` : null;
}
