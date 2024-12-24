import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from './../services/store.service';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';

@Injectable()
export class LanguageInterceptor implements HttpInterceptor {
	constructor(
		private _store: Store,
		private _translateService: TranslateService
	) { }

	intercept(
		request: HttpRequest<any>,
		next: HttpHandler
	): Observable<HttpEvent<any>> {
		const language: LanguagesEnum =
			this._store && this._store.preferredLanguage
				? this._store.preferredLanguage
				: this._translateService.getBrowserLang();
		request = request.clone({
			setHeaders: {
				Language: language,
			},
		});

		return next.handle(request);
	}
}
