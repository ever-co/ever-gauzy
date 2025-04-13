import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PosthogService } from './posthog.service';

@Injectable()
export class PosthogErrorInterceptor implements NestInterceptor {
	constructor(private readonly posthog: PosthogService) {}

	/**
	 * Intercepts exceptions and tracks them to PostHog
	 * @param context - Execution context
	 * @param next - Next call handler
	 * @returns Observable with error handling
	 */
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		return next.handle().pipe(
			catchError((err) => {
				const req = context.switchToHttp().getRequest();
				this.posthog.track('error', req.ip || 'unknown', {
					error: err.message,
					stack: err.stack,
					path: req.path,
					$timestamp: new Date().toISOString()
				});
				return throwError(() => err);
			})
		);
	}
}
