import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PostHogService } from '../services/posthog.service';
import { PostHogServiceManager } from '../services/posthog-manager.service';

/**
 * HTTP interceptor that automatically tracks API requests using PostHog.
 * Captures duration, status, method, and error info (if any).
 */
@Injectable()
export class PostHogInterceptor implements HttpInterceptor {
	constructor(private posthogServiceManager: PostHogServiceManager) {}

	intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		const startTime = performance.now(); // More accurate timing
		const path = req.url.split('?')[0]; // Strip query params

		return next.handle(req).pipe(
			tap({
				next: (event) => {
					if (event instanceof HttpResponse) {
						const duration = Math.round(performance.now() - startTime);
						this.posthogServiceManager.trackEvent('api_request', {
							path,
							method: req.method,
							status: event.status,
							duration,
							success: true
						});
					}
				},
				error: (error) => {
					const duration = Math.round(performance.now() - startTime);
					this.posthogServiceManager.trackEvent('api_request', {
						path,
						method: req.method,
						status: error?.status ?? 'unknown',
						duration,
						success: false,
						errorMessage: error?.message ?? 'Unknown error'
					});
				}
			})
		);
	}
}
