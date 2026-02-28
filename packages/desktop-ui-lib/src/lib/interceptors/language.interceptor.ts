import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { Store } from './../services/store.service';

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
				: this._translateService.getBrowserLang() as LanguagesEnum;
		request = request.clone({
			setHeaders: {
				Language: language,
			},
		});

		return next.handle(request);
	}
}
