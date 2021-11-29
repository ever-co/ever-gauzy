import { Injectable } from '@angular/core';
import {
	HttpRequest,
	HttpHandler,
	HttpEvent,
	HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from './../services/store.service';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class LanguageInterceptor implements HttpInterceptor {
	constructor(private store: Store, private translate: TranslateService) {}

	intercept(
		request: HttpRequest<any>,
		next: HttpHandler
	): Observable<HttpEvent<any>> {
		const language =
			this.store && this.store.preferredLanguage
				? this.store.preferredLanguage
				: this.translate.getBrowserLang();

		request = request.clone({
			setHeaders: {
				Language: language
			}
		});

		return next.handle(request);
	}
}
