import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_PREFIX } from './../constants/app.constants';
// @ts-ignore
import { environment } from '@env/environment';

const baseUrl: string = environment?.API_BASE_URL;

@Injectable()
export class APIInterceptor implements HttpInterceptor {
	constructor() {}

	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		if (baseUrl && request.url.startsWith(`${API_PREFIX}`)) {
			const url = baseUrl.concat(request.url);
			request = request.clone({
				url: url
			});
		}
		return next.handle(request);
	}
}
