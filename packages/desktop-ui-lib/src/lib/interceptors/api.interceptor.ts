import { Inject, Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_PREFIX, GAUZY_ENV } from './../constants/app.constants';
import { Store } from '../services';

@Injectable()
export class APIInterceptor implements HttpInterceptor {
	constructor(
		private readonly _store: Store,
		@Inject(GAUZY_ENV)
		private readonly environment: any
	) {}

	intercept(
		request: HttpRequest<any>,
		next: HttpHandler
	): Observable<HttpEvent<any>> {
		const baseUrl = this.environment?.API_BASE_URL;
		const apiBaseUrl = baseUrl ? baseUrl : this._store.host;
		if (apiBaseUrl && request.url.startsWith(`${API_PREFIX}`)) {
			const url = apiBaseUrl.concat(request.url);
			request = request.clone({
				url: url,
			});
		}
		return next.handle(request);
	}
}
