import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

const BASE = `${API_PREFIX}/ever-connect`;

export type ConnectionStatus = 'connected' | 'pending_approval' | 'revoked' | 'disconnected';

/** `GET /api/ever-connect/status`. */
export interface EverConnectStatus {
	enabled: true;
	install_source: string;
	managed_by: 'ever_cloud' | 'operator';
	operator: boolean;
	connected: boolean;
	connection: {
		status: ConnectionStatus;
		platform_instance_id: string | null;
		kid: string | null;
		owner_handle: string | null;
		connected_at: string | null;
		last_heartbeat_at: string | null;
		feed_mode: string;
		last_error: string | null;
		api_url: string | null;
		return_url: string | null;
		return_unusable: boolean;
		key_material: 'ok' | 'no_secret' | 'jwt_secret_default' | 'encryption_key_default';
		secret_short: boolean;
		connect_key: 'none' | 'ok' | 'unreadable';
		env_code: 'none' | 'pending' | 'used';
	} | null;
	link: EverConnectLink | null;
	pending_approvals: EverConnectIntegration[];
	in_product_consent: boolean;
}

export interface EverConnectLink {
	integration_tenant_id: string | null;
	link_id: string;
	ever_org_id: string;
	handle: string | null;
	status: string;
	linked_at: string;
}

export interface EverConnectScopeRow {
	field_path: string;
	direction: string;
	form: string;
	frequency: string;
	purpose: string;
	retention: string;
}

/** One integration as `GET /api/ever-connect/integrations` lists it. */
export interface EverConnectIntegration {
	key: string;
	name: string;
	description: string;
	direction: string;
	instance_wide: boolean;
	app_ever_co_only: boolean;
	scope_version: number;
	scope: EverConnectScopeRow[];
	revoke_effect: string;
	state:
		| 'available'
		| 'enabled'
		| 'disabled'
		| 'denied_by_policy'
		| 'revoked_remote'
		| 'coming_soon'
		| 'pending_operator'
		| 'not_linked';
	enabled: boolean;
	pending_remote_revoke: boolean;
	revoke_source: string | null;
	revoked_at: string | null;
	consent: { id: string; at: string | null; source: string | null } | null;
	policy: 'allowed' | 'denied_by_env' | 'denied_by_policy';
}

export interface EverConnectEntitlement {
	subject: 'instance' | 'link';
	status: 'valid' | 'stale' | 'paused';
	/** valid; grace (could not be refreshed, features still apply); paused (Ever Platform features off). */
	ladder: 'valid' | 'grace' | 'paused';
	/** Licence certificate ids the document names, shown as "Licence EVER-… active". */
	licence_ids: string[];
	seq: number | null;
	issued_at: string | null;
	expires_at: string | null;
	fetched_at: string | null;
	handle: string | null;
	tier: string | null;
	plan: string | null;
	features: Record<string, boolean>;
	limits: Record<string, number>;
	meters: Record<string, { used: number; period: string | null }>;
}

export interface EverConnectPolicyRow {
	key: string;
	name: string;
	allowed: boolean;
	source: 'env' | 'ui' | 'default';
}

export interface EverConnectAuditRow {
	id: string;
	at: string;
	action: string;
	actor_label: string;
	integration: string | null;
	details: Record<string, unknown>;
	scope: 'instance' | 'organization';
}

/** The Ever Platform routes of the API. Every route of the organization side takes `organizationId`. */
@Injectable({ providedIn: 'root' })
export class EverConnectUiService {
	private readonly http = inject(HttpClient);

	private org(organizationId?: string | null): { params: HttpParams } {
		return { params: organizationId ? new HttpParams().set('organizationId', organizationId) : new HttpParams() };
	}

	status(organizationId?: string | null): Observable<EverConnectStatus> {
		return this.http.get<EverConnectStatus>(`${BASE}/status`, this.org(organizationId));
	}

	integrations(organizationId: string): Observable<EverConnectIntegration[]> {
		return this.http.get<EverConnectIntegration[]>(`${BASE}/integrations`, this.org(organizationId));
	}

	refresh(organizationId: string): Observable<EverConnectIntegration[]> {
		return this.http.post<EverConnectIntegration[]>(`${BASE}/integrations/refresh`, {}, this.org(organizationId));
	}

	consentUrl(key: string, organizationId: string): Observable<{ url: string; expires_at: string }> {
		return this.http.post<{ url: string; expires_at: string }>(
			`${BASE}/integrations/${encodeURIComponent(key)}/consent-url`,
			{},
			this.org(organizationId)
		);
	}

	disable(key: string, organizationId: string): Observable<EverConnectIntegration> {
		return this.http.put<EverConnectIntegration>(
			`${BASE}/integrations/${encodeURIComponent(key)}`,
			{ enabled: false },
			this.org(organizationId)
		);
	}

	accept(key: string, accepted: boolean): Observable<EverConnectIntegration> {
		return this.http.post<EverConnectIntegration>(`${BASE}/integrations/${encodeURIComponent(key)}/accept`, {
			accepted
		});
	}

	connect(
		code: string,
		organizationId: string | null
	): Observable<{ status: ConnectionStatus; kid: string | null; link: EverConnectLink | null }> {
		return this.http.post<{ status: ConnectionStatus; kid: string | null; link: EverConnectLink | null }>(
			`${BASE}/connect`,
			{
				code,
				...(organizationId ? { organizationId } : {})
			}
		);
	}

	checkApproval(): Observable<{ status: ConnectionStatus }> {
		return this.http.post<{ status: ConnectionStatus }>(`${BASE}/connection/check`, {});
	}

	/** Replaces the connect key (the installation stays connected). */
	rotateKey(): Observable<{ kid: string }> {
		return this.http.post<{ kid: string }>(`${BASE}/connection/rotate-key`, {});
	}

	disconnect(): Observable<{ status: ConnectionStatus }> {
		return this.http.post<{ status: ConnectionStatus }>(`${BASE}/disconnect`, { confirm: true });
	}

	policy(): Observable<EverConnectPolicyRow[]> {
		return this.http.get<EverConnectPolicyRow[]>(`${BASE}/policy`);
	}

	setPolicy(key: string, allowed: boolean): Observable<EverConnectPolicyRow[]> {
		return this.http.put<EverConnectPolicyRow[]>(`${BASE}/policy/${encodeURIComponent(key)}`, { allowed });
	}

	link(linkCode: string, organizationId: string): Observable<EverConnectLink> {
		return this.http.post<EverConnectLink>(`${BASE}/links`, { link_code: linkCode }, this.org(organizationId));
	}

	unlink(integrationTenantId: string, organizationId: string): Observable<void> {
		return this.http.delete<void>(
			`${BASE}/links/${encodeURIComponent(integrationTenantId)}`,
			this.org(organizationId)
		);
	}

	entitlement(
		organizationId: string
	): Observable<{ instance: EverConnectEntitlement | null; link: EverConnectEntitlement | null }> {
		return this.http.get<{ instance: EverConnectEntitlement | null; link: EverConnectEntitlement | null }>(
			`${BASE}/entitlement`,
			this.org(organizationId)
		);
	}

	refreshEntitlement(
		organizationId: string
	): Observable<{ instance: EverConnectEntitlement | null; link: EverConnectEntitlement | null }> {
		return this.http.post<{ instance: EverConnectEntitlement | null; link: EverConnectEntitlement | null }>(
			`${BASE}/entitlement/refresh`,
			{},
			this.org(organizationId)
		);
	}

	/** Operator only: imports a downloaded entitlement document (`.jws`). */
	importEntitlement(jws: string): Observable<{ subject: 'instance' | 'link'; seq: number; status: 'stored' | 'unchanged' }> {
		return this.http.post<{ subject: 'instance' | 'link'; seq: number; status: 'stored' | 'unchanged' }>(
			`${BASE}/entitlement/import`,
			{ jws }
		);
	}

		audit(organizationId: string, page: number): Observable<{ items: EverConnectAuditRow[]; total: number }> {
		return this.http.get<{ items: EverConnectAuditRow[]; total: number }>(`${BASE}/audit`, {
			params: new HttpParams().set('organizationId', organizationId).set('page', String(page)).set('limit', '20')
		});
	}
}
