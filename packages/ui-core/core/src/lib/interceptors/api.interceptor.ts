import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@gauzy/ui-config';
import { API_PREFIX } from '@gauzy/ui-core/common';

// Base URL
const baseUrl = environment.API_BASE_URL;

@Injectable()
export class APIInterceptor implements HttpInterceptor {
	public logging: boolean = false;

	/**
	 * Intercepts HTTP requests and modifies the URL if it starts with the API prefix.
	 * @param request The outgoing HTTP request.
	 * @param next The next handler in the HTTP request chain.
	 * @returns An observable of the HTTP event.
	 */
	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		if (baseUrl && request.url.startsWith(API_PREFIX)) {
			// Base URL is defined, modify the URL
			const url = baseUrl + request.url;

			// Log the request if logging is enabled
			if (this.logging) {
				console.log(`API Request: ${request.url} -> ${url}`);
			}

			// Clone the request and modify the URL
			request = request.clone({ url });
		}
		return next.handle(request);
	}
}
