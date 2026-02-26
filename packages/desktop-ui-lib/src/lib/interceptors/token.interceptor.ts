import { inject, Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from '../services';
import { TokenRequestCloner } from '../auth';
import { GAUZY_ENV } from './../constants/app.constants';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
	private readonly requestCloner = inject(TokenRequestCloner);
	private readonly store = inject(Store);
	private readonly environment = inject(GAUZY_ENV);

	isApiRequest(url: string) {
		const baseUrl = this.environment?.API_BASE_URL;
		const apiBaseUrl = baseUrl ? baseUrl : this.store.host;
		return url.startsWith(apiBaseUrl);
	}

	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		if (!this.isApiRequest(request.url)) {
			return next.handle(request);
		}
		return next.handle(this.requestCloner.cloneWithToken(request, this.store.token));
	}
}
