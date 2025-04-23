import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PosthogService } from './posthog.service';

@Injectable()
export class PosthogTraceMiddleware implements NestMiddleware {
	constructor(private readonly posthog: PosthogService) {}

	/**
	 * Tracks request performance metrics and status codes
	 * Attaches to response finish event to capture final timing
	 * @param req - Incoming HTTP request
	 * @param res - HTTP response
	 * @param next - Next middleware function
	 */
	use(req: Request, res: Response, next: NextFunction) {
		const start = Date.now();
		const { method, path } = req;

		res.on('finish', () => {
			const duration = Date.now() - start;
			try {
				this.posthog.track('http_request', req.ip || 'unknown', {
					method,
					path,
					status_code: res.statusCode,
					duration_ms: duration,
					$timestamp: new Date(start).toISOString()
				});
			} catch (e) {
				// Silently continue if analytics tracking fails
				console.error('Error capturing HTTP status code', e);
			}
		});

		next();
	}
}
