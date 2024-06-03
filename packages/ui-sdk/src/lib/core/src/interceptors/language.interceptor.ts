import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from '@gauzy/ui-sdk/common';
import { I18nTranslateService } from '@gauzy/ui-sdk/i18n';

@Injectable()
export class LanguageInterceptor implements HttpInterceptor {
	constructor(private readonly store: Store, private readonly _i18nTranslateService: I18nTranslateService) {}

	/**
	 * Intercepts HTTP requests to add a language header.
	 * @param request The outgoing HTTP request.
	 * @param next The next handler in the interceptor chain.
	 * @returns An observable of the HTTP event.
	 */
	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		const language = this.store?.preferredLanguage ?? this._i18nTranslateService.getBrowserLang();
		request = request.clone({
			setHeaders: {
				Language: language
			}
		});

		return next.handle(request);
	}
}
