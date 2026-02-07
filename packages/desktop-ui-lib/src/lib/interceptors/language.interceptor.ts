import { Injectable, Injector } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from './../services/store.service';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';

@Injectable()
export class LanguageInterceptor implements HttpInterceptor {
	private _translateService: TranslateService;

	constructor(private _store: Store, private _injector: Injector) {}

	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		// Skip this interceptor for translation file requests to avoid circular dependency
		// Translation files don't need the Language header anyway
		if (this.isTranslationRequest(request.url)) {
			return next.handle(request);
		}

		// Lazy-load TranslateService to avoid circular dependency
		if (!this._translateService) {
			try {
				this._translateService = this._injector.get(TranslateService);
			} catch (error) {
				// TranslateService not available yet, skip adding Language header
				return next.handle(request);
			}
		}

		const language: LanguagesEnum =
			this._store && this._store.preferredLanguage
				? this._store.preferredLanguage
				: this._translateService?.getBrowserLang() || LanguagesEnum.ENGLISH;

		request = request.clone({
			setHeaders: {
				Language: language
			}
		});

		return next.handle(request);
	}

	private isTranslationRequest(url: string): boolean {
		// Check if this is a request for translation files
		// Translation files are typically loaded from /assets/i18n/*.json
		return url.includes('/assets/i18n/') || (url.includes('/i18n/') && url.endsWith('.json'));
	}
}
