import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from '@gauzy/ui-sdk/common';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
	constructor(private readonly store: Store) {}

	/**
	 * Intercepts an HTTP request and adds an authorization token to the request headers.
	 *
	 * @param {HttpRequest<any>} request - The outgoing HTTP request.
	 * @param {HttpHandler} next - The next handler in the interceptor chain.
	 * @return {Observable<HttpEvent<any>>} - An observable of the HTTP event.
	 */
	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		const token = this.store.token;
		request = request.clone({
			setHeaders: {
				Authorization: `Bearer ${token}`
			}
		});
		return next.handle(request);
	}
}
