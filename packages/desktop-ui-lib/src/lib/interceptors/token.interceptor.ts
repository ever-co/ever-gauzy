import { Inject, inject, Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from '../services';
import { TokenRequestCloner } from '../auth';
import { API_PREFIX, GAUZY_ENV } from './../constants/app.constants';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
	private readonly requestCloner = inject(TokenRequestCloner);
	private readonly store = inject(Store);

	constructor(@Inject(GAUZY_ENV) private readonly environment: any) {}

	isApiRequest(url: string): boolean {
		try {
			// When this interceptor runs before APIInterceptor (Electron apps), the URL
			// is still relative (e.g. '/api/users'). new URL() throws on bare relative
			// paths, so attempt absolute parsing first; on failure treat it as relative.
			let parsed: URL;
			try {
				parsed = new URL(url);
			} catch {
				// Relative path — only the pathname is meaningful here.
				return url.startsWith(API_PREFIX);
			}

			// Absolute URL: verify both origin and pathname so the token is only
			// attached to the intended API server and never to a third-party host.
			const baseUrl = this.environment?.API_BASE_URL || this.store.host;
			if (!baseUrl) {
				return false;
			}
			const expectedOrigin = new URL(baseUrl).origin;
			return parsed.origin === expectedOrigin && parsed.pathname.startsWith(API_PREFIX);
		} catch {
			return false;
		}
	}

	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		if (!this.isApiRequest(request.url)) {
			return next.handle(request);
		}
		return next.handle(this.requestCloner.cloneWithToken(request, this.store.token));
	}
}
