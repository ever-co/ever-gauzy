import { inject, Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from '../services';
import { TokenRequestCloner } from '../auth';
import { API_PREFIX } from './../constants/app.constants';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
	private readonly requestCloner = inject(TokenRequestCloner);
	private readonly store = inject(Store);

	isApiRequest(url: string) {
		return url.includes(API_PREFIX);
	}

	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		if (!this.isApiRequest(request.url)) {
			return next.handle(request);
		}
		return next.handle(this.requestCloner.cloneWithToken(request, this.store.token));
	}
}
