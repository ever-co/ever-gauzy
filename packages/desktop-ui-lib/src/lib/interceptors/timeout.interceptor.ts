/**
 * Idea of how to handle timeout is taken from https://gist.github.com/harbirchahal/84d3d7dd1d0838479d298a06b1c51928
 * Original code author: Harbir Chahal (https://github.com/harbirchahal)
 */
import { Inject, Injectable, InjectionToken } from '@angular/core';
import {
	HttpRequest,
	HttpHandler,
	HttpEvent,
	HttpInterceptor
} from '@angular/common/http';
import { Observable, timeout } from 'rxjs';

export const DEFAULT_TIMEOUT = new InjectionToken<number>('defaultTimeout');

@Injectable()
export class TimeoutInterceptor implements HttpInterceptor {

	constructor(
		@Inject(DEFAULT_TIMEOUT) protected defaultTimeout: number,
	) { }

	intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
		const cloned = request.clone({
			setHeaders: { 'X-Request-Timeout': `${this.defaultTimeout}` }
		});
		return next.handle(cloned).pipe(
			timeout(this.defaultTimeout)
		);
	}
}
