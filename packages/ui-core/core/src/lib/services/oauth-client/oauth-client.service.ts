/**
 * HTTP client for the multi-app OAuth client registry.
 *
 * Backs the admin CRUD page at `/pages/settings/oauth-clients`. Wraps the
 * NestJS controller mounted at `/oauth/clients` (see
 * `packages/core/src/lib/auth/oauth-client/oauth-client.controller.ts`).
 *
 * The `create` and `rotateSecret` endpoints return the plaintext client
 * secret EXACTLY ONCE via `IOAuthClientWithSecret` — the caller must
 * surface it to the admin immediately (we show it in a one-time reveal
 * dialog) because it is never retrievable afterwards.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';
import type {
	ID,
	IOAuthClient,
	IOAuthClientCreateInput,
	IOAuthClientUpdateInput,
	IOAuthClientWithSecret,
	IPagination
} from '@gauzy/contracts';

@Injectable({ providedIn: 'root' })
export class OAuthClientManagementService {
	private readonly baseUrl = `${API_PREFIX}/oauth/clients`;

	constructor(private readonly http: HttpClient) {}

	/** Paginated list of OAuth clients visible to the current user. */
	list(params: { skip?: number; take?: number } = {}): Observable<IPagination<IOAuthClient>> {
		let httpParams = new HttpParams();
		if (typeof params.skip === 'number') httpParams = httpParams.set('skip', String(params.skip));
		if (typeof params.take === 'number') httpParams = httpParams.set('take', String(params.take));
		return this.http.get<IPagination<IOAuthClient>>(this.baseUrl, { params: httpParams });
	}

	/** Read a single client by internal uuid. */
	getById(id: ID): Observable<IOAuthClient> {
		return this.http.get<IOAuthClient>(`${this.baseUrl}/${id}`);
	}

	/**
	 * Register a new OAuth client.
	 * Returns the plaintext client secret ONCE — surface it immediately.
	 */
	create(input: IOAuthClientCreateInput): Observable<IOAuthClientWithSecret> {
		return this.http.post<IOAuthClientWithSecret>(this.baseUrl, input);
	}

	/** Update mutable fields (name, redirectUris, scopes, etc.). */
	update(id: ID, input: IOAuthClientUpdateInput): Observable<IOAuthClient> {
		return this.http.patch<IOAuthClient>(`${this.baseUrl}/${id}`, input);
	}

	/**
	 * Rotate the client secret. Old access tokens keep working until they
	 * expire; only NEW `/token` exchanges must use the rotated secret.
	 * Returns the plaintext secret ONCE.
	 */
	rotateSecret(id: ID): Observable<IOAuthClientWithSecret> {
		return this.http.post<IOAuthClientWithSecret>(`${this.baseUrl}/${id}/rotate-secret`, {});
	}

	/** Soft-delete (revoke). After this, `findByClientId` refuses to resolve the row. */
	delete(id: ID): Observable<void> {
		return this.http.delete<void>(`${this.baseUrl}/${id}`);
	}
}
