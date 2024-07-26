import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from '@gauzy/ui-core/common';
import { I18nService } from '@gauzy/ui-core/i18n';

@Injectable()
export class LanguageInterceptor implements HttpInterceptor {
	constructor(readonly store: Store, readonly _i18nService: I18nService) {}

	/**
	 * Intercepts HTTP requests to add a language header.
	 * @param request The outgoing HTTP request.
	 * @param next The next handler in the interceptor chain.
	 * @returns An observable of the HTTP event.
	 */
	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		// Get the preferred language from the store or the browser language
		const language = this.store?.preferredLanguage ?? this._i18nService.getBrowserLang();

		// Clone the request and add the language header
		request = request.clone({
			setHeaders: {
				Language: language
			}
		});

		// Pass the cloned request to the next interceptor in the chain
		return next.handle(request);
	}
}
