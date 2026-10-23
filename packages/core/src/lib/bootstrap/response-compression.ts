import * as compression from 'compression';
import type { Request, RequestHandler, Response } from 'express';
import { readNonNegativeIntEnv } from './strict-int-env';

/**
 * HTTP response compression for the API.
 *
 * Nothing compressed the API's responses until now — not the API itself, and the ingress in front of it does not
 * either — so every JSON body crossed the network as it was: `/role-permissions/me` is ~164 KB per login,
 * `/employee/pagination` and `/tasks/pagination` pages tens of KB. JSON compresses 8–15×, and the transfer is
 * what the browser waits for after the API has answered. gzip (and Brotli, where the client accepts `br`) is now
 * negotiated per request through the `compression` middleware; the encoding itself runs on zlib's thread pool,
 * not on the event loop.
 *
 * Environment:
 * - `API_COMPRESSION`           — `false` / `0` / `no` / `off` disables it (default: on).
 * - `API_COMPRESSION_LEVEL`     — zlib level 0–9 (default 6, zlib's own default).
 * - `API_COMPRESSION_THRESHOLD` — smallest response, in bytes, worth compressing (default 1024).
 *
 * Streams that must reach the client as they are produced (`text/event-stream`) are never compressed, and a
 * client can opt out of a response with the `X-No-Compression` header.
 */

export interface ResponseCompressionSettings {
	readonly enabled: boolean;
	/** zlib compression level, 0–9. */
	readonly level: number;
	/** Smallest response (bytes) that is compressed. */
	readonly threshold: number;
}

export const DEFAULT_COMPRESSION_LEVEL = 6;
export const DEFAULT_COMPRESSION_THRESHOLD = 1024;

/** The values of `API_COMPRESSION` that turn compression off; anything else (and unset) leaves it on. */
const OFF_VALUES = new Set(['false', '0', 'no', 'off']);

/**
 * Reads the compression settings from the environment.
 *
 * @param env - The process environment.
 * @param logger - Where an invalid value is reported.
 */
export function resolveResponseCompression(
	env: NodeJS.ProcessEnv,
	logger: { warn: (message: string) => void } = console
): ResponseCompressionSettings {
	const enabled = !OFF_VALUES.has(
		String(env.API_COMPRESSION ?? '')
			.trim()
			.toLowerCase()
	);

	let level = readNonNegativeIntEnv(
		'API_COMPRESSION_LEVEL',
		env.API_COMPRESSION_LEVEL,
		DEFAULT_COMPRESSION_LEVEL,
		logger
	);
	if (level > 9) {
		logger.warn(
			`Ignoring invalid API_COMPRESSION_LEVEL "${env.API_COMPRESSION_LEVEL}": zlib levels are 0 to 9. Using ${DEFAULT_COMPRESSION_LEVEL}.`
		);
		level = DEFAULT_COMPRESSION_LEVEL;
	}

	const threshold = readNonNegativeIntEnv(
		'API_COMPRESSION_THRESHOLD',
		env.API_COMPRESSION_THRESHOLD,
		DEFAULT_COMPRESSION_THRESHOLD,
		logger
	);

	return { enabled, level, threshold };
}

/**
 * Whether a response may be compressed: not when the client asked for none (`X-No-Compression`), never for a
 * server-sent event stream (its events must reach the client as they are written, not when a compression
 * buffer fills), otherwise the middleware's own rule (compressible content types, no `no-transform`).
 *
 * @param req - The request.
 * @param res - The response, with its headers set.
 */
export function shouldCompressResponse(req: Request, res: Response): boolean {
	if (req.headers['x-no-compression']) {
		return false;
	}
	const contentType = String(res.getHeader('Content-Type') ?? '');
	if (/^text\/event-stream/i.test(contentType)) {
		return false;
	}
	return compression.filter(req, res);
}

/**
 * The compression middleware for the given settings, or `null` when compression is off.
 *
 * @param settings - From {@link resolveResponseCompression}.
 */
export function createResponseCompression(settings: ResponseCompressionSettings): RequestHandler | null {
	if (!settings.enabled) {
		return null;
	}
	return compression({ level: settings.level, threshold: settings.threshold, filter: shouldCompressResponse });
}
