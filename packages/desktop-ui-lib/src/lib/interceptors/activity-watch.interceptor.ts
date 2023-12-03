import { Inject, Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ACTIVITY_WATCH_PREFIX, GAUZY_ENV } from '../constants';

@Injectable()
export class ActivityWatchInterceptor implements HttpInterceptor {
	constructor(
		@Inject(GAUZY_ENV)
		private readonly environment: any
	) {}

	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		const baseUrl = this.environment?.AWHost || 'http://localhost:5600';
		const API_VERSION = '/api/0';
		if (baseUrl && request.url.startsWith(`${API_ACTIVITY_WATCH_PREFIX}`)) {
			const url = baseUrl.concat(API_VERSION).concat(request.url);
			request = request.clone({ url });
		}
		return next.handle(request);
	}
}
