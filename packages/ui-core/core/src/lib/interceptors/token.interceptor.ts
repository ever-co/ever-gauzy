import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, type HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from '../services/store';

/**
 * The app's own static files (`./assets/…`: translations, icons, images). They are public and never need the user's
 * token — and the token is large: it carries every permission of the user's role (~11.5 KB for a super admin), past the
 * 8 KB header line nginx accepts by default, so sending it made `./assets/i18n/en.json` answer 400 for signed-in users.
 */
const OWN_STATIC_ASSET = /^(\.\/|\/)?assets\//;

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
		if (OWN_STATIC_ASSET.test(request.url)) {
			return next.handle(request);
		}
		const token = this.store.token;
		request = request.clone({
			setHeaders: {
				Authorization: `Bearer ${token}`
			}
		});
		return next.handle(request);
	}
}
