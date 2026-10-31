import { performance } from 'node:perf_hooks';
import { Inject, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { HTTP_REQUEST_LOGGER_OPTIONS, HttpRequestLoggerOptions } from './http-request-logger.options';
import { createSensitiveParameterMatcher, redactRequestUrl } from './redact-request-url';

/** The level of a request's line: a server error is a warning, everything else an ordinary log line. */
export function httpRequestLogLevel(statusCode: number): 'log' | 'warn' {
	return statusCode >= 500 ? 'warn' : 'log';
}

/** A byte count as a short human-readable size: `512B`, `1.5kB`, `2.3MB`. */
export function formatByteSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes}B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)}kB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** What one line of the HTTP request log says. */
export interface HttpRequestLogEntry {
	method: string;
	/** Already redacted (see `redactRequestUrl`). */
	url: string;
	statusCode: number;
	durationMs: number;
	/** The client went away before the response was complete. */
	aborted?: boolean;
	contentLength?: number;
	requestId?: string;
}

/**
 * One line per request: `GET /api/employee?page=1 200 12.3ms 1.5kB [<request id>]`, or
 * `GET /api/employee aborted after 12.3ms [<request id>]` when the client went away first.
 */
export function formatHttpRequestLog(entry: HttpRequestLogEntry): string {
	const duration = `${entry.durationMs.toFixed(1)}ms`;
	const parts = entry.aborted
		? [entry.method, entry.url, 'aborted after', duration]
		: [entry.method, entry.url, String(entry.statusCode), duration];
	if (!entry.aborted && entry.contentLength !== undefined) {
		parts.push(formatByteSize(entry.contentLength));
	}
	if (entry.requestId) {
		parts.push(`[${entry.requestId}]`);
	}
	return parts.join(' ');
}

/** Whether `path` is `prefix` itself or below it (`/api/health` covers `/api/health/db`, not `/api/healthy`). */
export function isPathUnder(path: string, prefix: string): boolean {
	return path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
}

/**
 * Logs one line per HTTP request once its response is finished (`LOG_HTTP_REQUESTS=true`, see
 * `HttpRequestLoggerModule`): method, URL, status, duration, response size and request id.
 *
 * It never reads a header (no `Authorization`, cookies or API keys) or a body. The URL is written with every
 * sensitive query or route parameter redacted (see `redactRequestUrl`). Lines go through the Nest `Logger`, so they
 * follow `LOG_LEVEL` and whatever logger the application installed (the Sentry logger included, where they are
 * breadcrumbs rather than events at its default `SENTRY_LOG_LEVELS`).
 *
 * The duration runs from this middleware to the last byte of the response, so it covers guards, pipes, the
 * handler and serialization.
 */
@Injectable()
export class HttpRequestLoggerMiddleware implements NestMiddleware {
	private readonly logger: Logger;
	private readonly isSensitive: (name: string) => boolean;

	constructor(@Inject(HTTP_REQUEST_LOGGER_OPTIONS) private readonly options: HttpRequestLoggerOptions) {
		this.logger = new Logger(options.context);
		this.isSensitive = createSensitiveParameterMatcher(options.redactParameters);
	}

	use(req: Request, res: Response, next: NextFunction): void {
		const url = req.originalUrl ?? req.url ?? '';
		const path = url.split('?')[0];
		if (this.options.ignorePaths.some((prefix) => isPathUnder(path, prefix))) {
			return next();
		}

		const started = performance.now();
		let logged = false;
		const done = (aborted: boolean) => {
			if (logged) {
				return;
			}
			logged = true;
			this.write(req, res, url, performance.now() - started, aborted);
		};
		// `close` also follows a completed response; only a `close` without `finish` before it is an abort.
		res.once('finish', () => done(false));
		res.once('close', () => done(true));

		next();
	}

	private write(req: Request, res: Response, url: string, durationMs: number, aborted: boolean): void {
		const level = aborted ? 'log' : httpRequestLogLevel(res.statusCode);
		if (!Logger.isLevelEnabled(level)) {
			return;
		}
		const contentLength = Number(res.getHeader('content-length'));
		const requestId = res.getHeader(this.options.requestIdHeader);
		this.logger[level](
			formatHttpRequestLog({
				method: req.method,
				// Read when the response is done, so the route parameters the router matched are known.
				url: redactRequestUrl(url, { isSensitive: this.isSensitive, params: req.params }),
				statusCode: res.statusCode,
				durationMs,
				aborted,
				contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
				requestId: typeof requestId === 'string' ? requestId : undefined
			})
		);
	}
}
