import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_PREFIX } from './../constants/app.constants';
// @ts-ignore
import { environment } from '@env/environment';
import { Store } from '../services';

const baseUrl: string = environment?.API_BASE_URL;

@Injectable()
export class APIInterceptor implements HttpInterceptor {
	constructor(private readonly _store: Store) {}

	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		const apiBaseUrl = baseUrl ? baseUrl : this._store.host;
		if (apiBaseUrl && request.url.startsWith(`${API_PREFIX}`)) {
			const url = apiBaseUrl.concat(request.url);
			request = request.clone({
				url: url
			});
		}
		return next.handle(request);
	}
}
