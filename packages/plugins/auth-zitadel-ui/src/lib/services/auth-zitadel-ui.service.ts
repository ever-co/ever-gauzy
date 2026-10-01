import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { ITermsAcceptanceClaim, IUserSigninWorkspaceResponse } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

const BASE = `${API_PREFIX}/auth/zitadel`;

/** The answer of `GET /api/auth/zitadel/config`. */
export interface EverIdConfig {
	enabled: boolean;
	issuer?: string;
	link_modes?: Array<'explicit' | 'confirmed'>;
	signup?: boolean;
}

/** A workspace that the Ever ID sign-in may not enter, and why. */
export interface EverIdBlockedWorkspace {
	tenantId: string | null;
	tenantName: string;
	reason: string;
}

/** The workspace list of an Ever ID sign-in. */
export interface EverIdWorkspaceResponse extends IUserSigninWorkspaceResponse {
	blocked_workspaces?: EverIdBlockedWorkspace[];
	redirect?: string;
}

/** What a hand-off key redeems to. */
export type EverIdHandoff =
	| { kind: 'workspaces'; response: EverIdWorkspaceResponse }
	| { kind: 'register'; prefill: { email: string; firstName?: string; lastName?: string } };

/** What the sign-up confirmation page shows. */
export interface EverIdSignupDetails {
	email: string;
	firstName?: string;
	lastName?: string;
	status?: 'subscription_required';
	checkoutUrl?: string;
}

/** A linked identity in Settings. */
export interface EverIdIdentity {
	id: string;
	issuer: string;
	subjectMasked: string;
	emailAtLink?: string;
	linkMethod: string;
	linkedAt: string;
	lastLoginAt?: string;
}

/** What the link confirmation screen shows. */
export interface EverIdLinkPreview {
	everIdEmail: string;
	accountEmail: string;
	siblings: Array<{ userId: string; tenantName: string }>;
}

/**
 * Talks to the Ever ID sign-in routes of the API. When the API plugin is not loaded every route
 * answers 404; `config()` turns that into `{ enabled: false }`.
 */
@Injectable({ providedIn: 'root' })
export class AuthZitadelUiService {
	private readonly http = inject(HttpClient);
	private config$: Observable<EverIdConfig> | null = null;

	/** The plugin configuration, fetched once per page load. */
	config(): Observable<EverIdConfig> {
		if (!this.config$) {
			this.config$ = this.http.get<EverIdConfig>(`${BASE}/config`).pipe(
				map((config) => ({ ...config, enabled: config?.enabled === true })),
				catchError(() => of({ enabled: false })),
				shareReplay({ bufferSize: 1, refCount: false })
			);
		}
		return this.config$;
	}

	redeemHandoff(handoff: string): Observable<EverIdHandoff> {
		return this.http.post<EverIdHandoff>(`${BASE}/handoff`, { handoff });
	}

	confirm(handoff: string, code: string): Observable<EverIdWorkspaceResponse> {
		return this.http.post<EverIdWorkspaceResponse>(`${BASE}/confirm`, { handoff, code });
	}

	signupDetails(handoff: string): Observable<EverIdSignupDetails> {
		return this.http.post<EverIdSignupDetails>(`${BASE}/signup/details`, { handoff });
	}

	signup(body: {
		handoff: string;
		confirm: boolean;
		firstName?: string;
		lastName?: string;
		terms?: ITermsAcceptanceClaim[];
	}): Observable<EverIdWorkspaceResponse> {
		return this.http.post<EverIdWorkspaceResponse>(`${BASE}/signup`, body);
	}

	startLink(): Observable<{ url: string }> {
		return this.http.post<{ url: string }>(`${BASE}/link`, {});
	}

	linkPreview(key: string): Observable<EverIdLinkPreview> {
		return this.http.post<EverIdLinkPreview>(`${BASE}/link/preview`, { key });
	}

	linkConfirm(key: string, rows: string[], code?: string): Observable<{ linked?: string[]; code_required?: boolean }> {
		return this.http.post<{ linked?: string[]; code_required?: boolean }>(`${BASE}/link/confirm`, {
			key,
			rows,
			...(code ? { code } : {})
		});
	}

	unlink(id: string): Observable<void> {
		return this.http.delete<void>(`${BASE}/link/${encodeURIComponent(id)}`);
	}

	identities(): Observable<EverIdIdentity[]> {
		return this.http.get<EverIdIdentity[]>(`${BASE}/identities`);
	}
}
