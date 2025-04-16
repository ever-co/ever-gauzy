import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PosthogService } from './posthog.service';

@Injectable()
export class PosthogRequestMiddleware implements NestMiddleware {
	constructor(private readonly posthog: PosthogService) {}

	/**
	 * Intercepts incoming requests to capture basic request information
	 * Identifies the user/device and sets initial event properties
	 * @param req - Incoming HTTP request
	 * @param res - HTTP response
	 * @param next - Next middleware function
	 */
	use(req: Request, res: Response, next: NextFunction) {
		// Capture essential request properties as user identification
		try {
			this.posthog.identify(req.ip || 'anonymous', {
				$current_url: req.originalUrl,
				$referrer: req.get('referer'),
				$user_agent: req.get('user-agent'),
				$host: req.get('host'),
				$pathname: req.path,
				ip: req.ip,
				http_method: req.method
			});
		} catch (error) {
			console.debug('PostHog analytics error:', error);
		}

		next();
	}
}
