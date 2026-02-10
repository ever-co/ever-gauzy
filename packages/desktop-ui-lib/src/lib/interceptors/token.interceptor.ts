import { inject, Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from '../services';
import { TokenRequestCloner } from '../auth';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
	private readonly requestCloner = inject(TokenRequestCloner);
	private readonly store = inject(Store);

	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		return next.handle(this.requestCloner.cloneWithToken(request, this.store.token));
	}
}
