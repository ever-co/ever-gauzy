/**
 * HTTP client for the signed-in user's own personal API tokens, behind the page at `/pages/settings/api-tokens`. Wraps
 * the controller at `/user-api-tokens` (`packages/core/src/lib/auth/user-api-token/user-api-token.controller.ts`).
 *
 * `create` returns the plain token exactly once: the caller has to show it at that moment, because it can never be
 * read again.
 */
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';
import type {
	ID,
	IPagination,
	IUserApiToken,
	IUserApiTokenConfig,
	IUserApiTokenCreateInput,
	IUserApiTokenWithSecret
} from '@gauzy/contracts';

@Injectable({ providedIn: 'root' })
export class UserApiTokenService {
	private readonly _http = inject(HttpClient);
	private readonly _baseUrl = `${API_PREFIX}/user-api-tokens`;

	/**
	 * Whether this server has API tokens on (`GAUZY_USER_API_TOKENS_ENABLED`). Asked once per page load and shared by
	 * every reader. Only an explicit `enabled: true` opens the page: a failed request, or an older API without the
	 * route, reads as off. Completes after its one value.
	 */
	readonly enabled$: Observable<boolean> = this._http.get<IUserApiTokenConfig>(`${this._baseUrl}/config`).pipe(
		map((config) => config?.enabled === true),
		catchError(() => of(false)),
		shareReplay({ bufferSize: 1, refCount: false })
	);

	/** The signed-in user's tokens, without the revoked ones and without any secret. */
	list(): Observable<IPagination<IUserApiToken>> {
		return this._http.get<IPagination<IUserApiToken>>(this._baseUrl);
	}

	/** Creates a token. The answer carries the plain token, this one time. */
	create(input: IUserApiTokenCreateInput): Observable<IUserApiTokenWithSecret> {
		return this._http.post<IUserApiTokenWithSecret>(this._baseUrl, input);
	}

	/** Revokes one of the signed-in user's tokens. */
	revoke(id: ID): Observable<void> {
		return this._http.delete<void>(`${this._baseUrl}/${id}`);
	}
}
