import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ITermsAcceptanceClaim, ITermsAcceptanceDocument, IUserSigninWorkspaceResponse } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

const BASE = `${API_PREFIX}/ever-connect/provision`;

/** `POST /api/ever-connect/provision/summary`: what the confirmation page shows. */
export interface ProvisionSummary {
	org_display_name: string;
	handle: string;
	legal_name: string | null;
	email: string;
	first_name: string | null;
	last_name: string | null;
	creates: { workspace: boolean; organization: boolean; admin_account: boolean; employee: boolean; team: boolean };
	tier: string;
	product_tenant_exists: boolean;
	/** The documents to accept, with links to this web app's pages for them. */
	terms: ITermsAcceptanceDocument[];
	return_to: string;
	expires_at: number;
}

/** `POST /api/ever-connect/provision`. */
export interface ProvisionResult {
	status: 'created' | 'exists';
	product_tenant_id: string;
	product_org_id: string;
	product_user_id: string;
	employee_id?: string;
	team_id?: string;
	sign_in_url: string | null;
	return_to: string;
}

/** What a one-time sign-in key of an Ever ID sign-in redeems to. */
export type EverIdHandoffRecord = { kind: 'workspaces'; response: IUserSigninWorkspaceResponse } | { kind: string };

/**
 * The pages Ever's web app may be returned to: app.ever.co and its stage and development hosts
 * (the API checks the same list when it verifies the request).
 */
export const EVER_RETURN_ORIGINS: ReadonlyArray<string> = Object.freeze([
	'https://app.ever.co',
	'https://app-stage.ever.co',
	'https://app-dev.ever.co'
]);

/**
 * Whether the page may send the person to `url`: a page of Ever's web app (https, no credentials), or of
 * a local one (`localhost`, `127.0.0.1`), which the API accepts from a test platform on a local address
 * only.
 */
export function isEverReturnUrl(url: unknown): url is string {
	if (typeof url !== 'string') return false;
	try {
		const parsed = new URL(url);
		if (parsed.username || parsed.password) return false;
		const local =
			(parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
			(parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
		return EVER_RETURN_ORIGINS.includes(parsed.origin) || local;
	} catch {
		return false;
	}
}

/** The one-time sign-in key in a `sign_in_url` (`…/#/auth/ever-id?handoff=<key>`), or `null`. */
export function handoffKeyOf(signInUrl: string | null | undefined): string | null {
	if (!signInUrl) return null;
	const hash = signInUrl.includes('#') ? signInUrl.slice(signInUrl.indexOf('#') + 1) : '';
	const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
	const key = new URLSearchParams(query).get('handoff');
	return key && /^[A-Za-z0-9_-]{16,128}$/.test(key) ? key : null;
}

/** The workspace routes from Ever (public: the person is not signed in to Gauzy yet). */
@Injectable({ providedIn: 'root' })
export class EverConnectProvisionService {
	private readonly http = inject(HttpClient);

	summary(provisionKey: string, handoffKey: string): Observable<ProvisionSummary> {
		return this.http.post<ProvisionSummary>(`${BASE}/summary`, {
			provision_key: provisionKey,
			handoff_key: handoffKey
		});
	}

	create(
		provisionKey: string,
		handoffKey: string,
		request: { first_name?: string; last_name?: string; terms?: ITermsAcceptanceClaim[] }
	): Observable<ProvisionResult> {
		return this.http.post<ProvisionResult>(BASE, { provision_key: provisionKey, handoff_key: handoffKey, request });
	}

	/** Redeems the one-time sign-in key of the new workspace (the Ever ID sign-in's own route). */
	redeemSignIn(handoff: string): Observable<EverIdHandoffRecord> {
		return this.http.post<EverIdHandoffRecord>(`${API_PREFIX}/auth/zitadel/handoff`, { handoff });
	}
}
