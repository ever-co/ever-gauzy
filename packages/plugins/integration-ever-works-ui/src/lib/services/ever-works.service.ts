import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

const BASE = `${API_PREFIX}/integration/ever-works`;

/** `GET /api/integration/ever-works/status`; the route exists only where the API loads the plugin. */
export interface EverWorksStatus {
	enabled: true;
	pluginVersion: string;
	contractVersion: string;
	defaultApiUrl: string | null;
	appUrl: string | null;
}

/** A pinned Ever Works organization of the key. */
export interface EverWorksPinnedOrganization {
	id: string;
	slug: string;
	displayName: string;
}

/** `POST /connections/validate`: what a key is (never the key). */
export interface EverWorksKeyValidation {
	apiBaseUrl: string;
	keyId: string;
	keyName: string;
	keyPrefix: string;
	tenant: { id: string; slug: string };
	organizations: EverWorksPinnedOrganization[];
	scopes: string[];
	missingScopes: string[];
	missingRequiredScopes: string[];
	apiVersion: string;
	compatible: boolean;
	feedHead: string;
	limits: { readsPerMin: number; writesPerMin: number };
}

export type EverWorksConnectionStatus = 'active' | 'paused' | 'needs_reauth' | 'error' | 'disconnected';

/** A connection (never the key or the webhook secret). */
export interface EverWorksConnection {
	id: string;
	organizationId: string | null;
	status: EverWorksConnectionStatus;
	authMode: 'api_key' | 'ever_id';
	apiBaseUrl: string;
	ewTenant: { id: string; slug: string | null };
	key: { id: string | null; name: string | null; prefix: string | null };
	scopes: string[];
	missingScopes: string[];
	pinnedOrganizations: EverWorksPinnedOrganization[];
	apiVersion: string | null;
	webhook: { registered: boolean; subscriptionId: string | null; url: string | null };
	feedCursor: string | null;
	lastError: string | null;
	lastErrorAt: string | null;
	lastHealthyAt: string | null;
	lastCheckedAt: string | null;
	connectedByUserId: string | null;
	createdAt: string | null;
	/** The connect answer only, when it resumed a connection holding a subscription its disconnect could not delete: whether it is gone now. */
	earlierWebhookDeleted?: boolean;
}

/** How a domain syncs. */
export type EverWorksDirection = 'both' | 'ew_to_gauzy' | 'gauzy_to_ew' | 'suggest' | 'link_only' | 'off';

/** The synced domains and the directions each one may take (the API refuses anything else). */
export const EVER_WORKS_DOMAINS: Readonly<Record<string, ReadonlyArray<EverWorksDirection>>> = {
	members: ['suggest', 'off'],
	agents: ['ew_to_gauzy', 'off'],
	teams: ['both', 'ew_to_gauzy', 'gauzy_to_ew', 'off'],
	works: ['link_only', 'off'],
	missions: ['ew_to_gauzy', 'both', 'off'],
	goals: ['both', 'ew_to_gauzy', 'gauzy_to_ew', 'off'],
	ideas: ['both', 'ew_to_gauzy', 'gauzy_to_ew', 'off'],
	tasks: ['both', 'ew_to_gauzy', 'gauzy_to_ew', 'off'],
	inbox: ['ew_to_gauzy', 'off'],
	docs: ['both', 'ew_to_gauzy', 'gauzy_to_ew', 'off'],
	// The read-only copy of Ever Works agent mail in the Gauzy Inbox (off by default).
	agentEmail: ['off', 'ew_to_gauzy']
};

/** One organization mapping and its settings. */
export interface EverWorksMapping {
	integrationTenantId: string;
	organizationId: string;
	connectionId: string;
	everWorksOrganization: { id: string; slug: string; displayName: string | null };
	isEnabled: boolean;
	directions: Record<string, EverWorksDirection>;
	defaultProjectId: string | null;
	ideasProjectId: string | null;
	docsRootFolderId: string | null;
	includeHiddenTasks: boolean;
	includeTriageTasks: boolean;
	includeGoalIterationKeyResults: boolean;
	syncUnlinkedProjectTasks: boolean;
	ideaIssueTypeId: string | null;
	ideasTaskViewId: string | null;
	entitySettings: Array<{ entity: string; sync: boolean }>;
}

export interface EverWorksMappingUpdate {
	directions?: Record<string, EverWorksDirection>;
	syncUnlinkedProjectTasks?: boolean;
	includeHiddenTasks?: boolean;
	includeTriageTasks?: boolean;
	isEnabled?: boolean;
}

/** People tab. */
export interface EverWorksPersonRow {
	ewUserId: string;
	username: string;
	displayName: string | null;
	email: string | null;
	emailVerified: boolean;
	role: string;
	isActive: boolean;
	linkedEmployeeId: string | null;
	/** How the pairing was made (absent from an older API, `null` while unpaired). */
	matchedBy?: EverWorksMatchSource | null;
	suggestion: { employeeId: string; reason: 'ever_id' | 'verified_email' } | null;
	/** A Gauzy invitation still pending for the member's e-mail (absent from an older API). */
	gauzyInvite?: { inviteId: string; expireDate: string | null } | null;
}
/** How a People-tab pairing was made: the same Ever ID, an accepted verified-e-mail suggestion, or by hand. */
export type EverWorksMatchSource = 'ever_id' | 'verified_email' | 'manual';
/** "Invite to Gauzy": a new invitation, or the one still pending for that e-mail. */
export interface EverWorksInviteToGauzyResult {
	status: 'invited' | 'pending';
	inviteId: string;
	email: string;
	roleId: string;
	expireDate: string | null;
}
/** "Invite to Ever Works": what Ever Works did (CR-13). */
export interface EverWorksInviteToEverWorksResult {
	status: 'invited' | 'pending' | 'already_member' | 'added';
	email: string;
	invitationId: string | null;
	expiresAt: string | null;
	ewUserId: string | null;
}
export interface EverWorksPeopleView {
	members: EverWorksPersonRow[];
	unmatchedEmployees: Array<{ employeeId: string; name: string; email: string | null }>;
	/** Ever Works inbox items waiting for their recipient to be paired (absent from an older API). */
	deferredInbox?: EverWorksDeferredInboxRow[];
}
/** One unpaired member's inbox items that wait (deferred) until the member is paired. */
export interface EverWorksDeferredInboxRow {
	ewUserId: string;
	count: number;
	items: Array<{ ewItemId: string; title: string; kind: string | null; occurredAt: string | null }>;
}
export interface EverWorksPeopleDecision {
	links?: Array<{ ewUserId: string; employeeId: string }>;
	unlinks?: string[];
	acceptSuggestions?: boolean;
}

/** Agents tab (agents are one way, Ever Works → Gauzy). */
export interface EverWorksAgentRow {
	ewAgentId: string;
	employeeId: string;
	name: string | null;
	status: string | null;
	isActive: boolean;
}

/** Teams tab. */
export interface EverWorksTeamRow {
	ewTeamId: string;
	name: string;
	slug: string | null;
	parentTeamId: string | null;
	linkedTeamId: string | null;
	suggestion: { teamId: string; reason: 'same_name' } | null;
}
export interface EverWorksTeamsView {
	teams: EverWorksTeamRow[];
	unmatchedTeams: Array<{ teamId: string; name: string }>;
}
export interface EverWorksTeamsDecision {
	links?: Array<{ ewTeamId: string; teamId: string }>;
	unlinks?: string[];
	acceptSuggestions?: boolean;
	createInGauzy?: string[];
	createInEverWorks?: string[];
}

/** Projects tab (projects ↔ works, link only). */
export interface EverWorksWorkRow {
	ewWorkId: string;
	name: string;
	kind: string | null;
	status: string | null;
	website: string | null;
	linkedProjectId: string | null;
	suggestion: { projectId: string; reason: 'same_name' | 'same_url' } | null;
}
export interface EverWorksProjectsView {
	works: EverWorksWorkRow[];
	unmatchedProjects: Array<{ projectId: string; name: string }>;
}
export interface EverWorksProjectsDecision {
	links?: Array<{ ewWorkId: string; projectId: string }>;
	unlinks?: string[];
	acceptSuggestions?: boolean;
	createInGauzy?: string[];
}

/** Initiatives ↔ Missions tab (missions ↔ strategic initiatives, plan 06 G-P2-2). */
export interface EverWorksMissionRow {
	ewMissionId: string;
	title: string;
	status: string | null;
	linkedInitiativeId: string | null;
	/** A same-title Gauzy initiative the admin may confirm (never paired silently). */
	suggestion: { initiativeId: string; reason: 'same_title' } | null;
}
export interface EverWorksInitiativesView {
	missions: EverWorksMissionRow[];
	/** Initiatives of the organization paired with no mission (leadership ones are never offered). */
	unmatchedInitiatives: Array<{ initiativeId: string; title: string; state: string }>;
}
export interface EverWorksInitiativesDecision {
	links?: Array<{ ewMissionId: string; initiativeId: string }>;
	unlinks?: string[];
	acceptSuggestions?: boolean;
	/** Ever Works missions to create as Gauzy initiatives. */
	createInGauzy?: string[];
	/** Gauzy initiatives to create in Ever Works (as paused missions; the missions direction must be "both"). */
	createInEverWorks?: string[];
}

/** The dry run of one phase. */
export interface EverWorksSyncPhasePreview {
	phase: string;
	domain: string;
	direction: EverWorksDirection;
	supported: boolean;
	note: string | null;
	everWorks: { total: number; linked: number; truncated: boolean } | null;
	gauzy: { total: number; linked: number } | null;
	creates: { inGauzy: number; inEverWorks: number };
	toPair: { everWorks: number; gauzy: number } | null;
}
export interface EverWorksSyncPreview {
	integrationTenantId: string;
	generatedAt: string;
	isEnabled: boolean;
	directions: Record<string, EverWorksDirection>;
	phases: EverWorksSyncPhasePreview[];
}

/** One phase of a run. */
export interface EverWorksSyncPhaseState {
	name: string;
	status: 'pending' | 'importing' | 'applying' | 'done' | 'skipped' | 'failed';
	message?: string | null;
	queued: number;
	duplicates: number;
	exported: number;
	attempts: number;
}
export interface EverWorksSyncRun {
	id: string;
	mode: 'initial' | 'resync';
	reason: string | null;
	status: 'running' | 'done' | 'failed' | 'cancelled';
	feedHead: string | null;
	currentPhase: string | null;
	phases: EverWorksSyncPhaseState[];
	requestedByUserId: string | null;
	startedAt: string | null;
	finishedAt: string | null;
	lastProgressAt: string | null;
	lastError: string | null;
}

/** `GET /mappings/:id/sync/status`. */
export interface EverWorksSyncStatus {
	integrationTenantId: string;
	organizationId: string;
	isEnabled: boolean;
	directions: Record<string, EverWorksDirection>;
	connection: {
		id: string;
		status: EverWorksConnectionStatus;
		lastError: string | null;
		lastErrorAt: string | null;
		lastHealthyAt: string | null;
		lastFeedPollAt: string | null;
		lastWebhookAt: string | null;
		resyncRequested: boolean;
	};
	lag: { head: string | null; readUpTo: string | null; lastApplied: string | null; behind: string | null; headError: string | null };
	inbound: { pending: number; deferred: number; failed: number; dead: number };
	outbound: { pending: number; pushing: number; deferred: number; failed: number; dead: number };
	conflicts: { open: number };
	lastError: { at: string | null; direction: string; entityType: string | null; action: string; message: string | null } | null;
	entities: Array<{ entityType: string; total: number; ok: number; conflict: number; error: number; orphaned: number; unlinked: number }>;
	run: EverWorksSyncRun | null;
	runs: EverWorksSyncRun[];
}

/** One sync log entry. */
export interface EverWorksSyncLogEntry {
	id: string;
	createdAt: string | null;
	direction: string;
	entityType: string | null;
	gauzyId: string | null;
	ewId: string | null;
	action: string;
	status: 'ok' | 'skipped' | 'conflict' | 'error';
	message: string | null;
	details: unknown;
	resolvedAt: string | null;
}

/** One conflict (both values in Gauzy terms, and the side that won). */
export interface EverWorksConflict {
	id: string;
	createdAt: string | null;
	direction: string;
	entityType: string | null;
	gauzyId: string | null;
	ewId: string | null;
	message: string | null;
	details: {
		field: string;
		gauzyField?: string;
		gauzyValue: unknown;
		everWorksValue: unknown;
		winner: 'gauzy' | 'ever_works';
		resolution?: 'keep' | 'use_other';
	} | null;
	resolved: boolean;
	resolvedAt: string | null;
	resolvedByUserId: string | null;
	canUseOther: boolean;
}

/** A page of the sync log or the conflicts; `nextCursor` asks for the next one. */
export interface EverWorksPage<T> {
	items: T[];
	nextCursor: string | null;
}

/** The Ever Works routes of the API. Every route takes the selected organization (`organizationId`). */
@Injectable({ providedIn: 'root' })
export class EverWorksUiService {
	private readonly http = inject(HttpClient);

	private org(organizationId?: string | null, extra: Record<string, string | null | undefined> = {}): { params: HttpParams } {
		let params = organizationId ? new HttpParams().set('organizationId', organizationId) : new HttpParams();
		for (const [key, value] of Object.entries(extra)) if (value !== undefined && value !== null && value !== '') params = params.set(key, value);
		return { params };
	}

	private mapping(integrationTenantId: string): string {
		return `${BASE}/mappings/${encodeURIComponent(integrationTenantId)}`;
	}

	status(organizationId?: string | null): Observable<EverWorksStatus> {
		return this.http.get<EverWorksStatus>(`${BASE}/status`, this.org(organizationId));
	}

	// ── Connection ────────────────────────────────────────────────────────────────────────────────

	connection(organizationId: string | null): Observable<EverWorksConnection | null> {
		return this.http.get<EverWorksConnection | null>(`${BASE}/connections`, this.org(organizationId));
	}

	validate(organizationId: string | null, apiBaseUrl: string, apiKey: string): Observable<EverWorksKeyValidation> {
		return this.http.post<EverWorksKeyValidation>(`${BASE}/connections/validate`, { apiBaseUrl, apiKey }, this.org(organizationId));
	}

	connect(organizationId: string | null, apiBaseUrl: string, apiKey: string): Observable<EverWorksConnection> {
		return this.http.post<EverWorksConnection>(`${BASE}/connections`, { apiBaseUrl, apiKey }, this.org(organizationId));
	}

	rotateKey(organizationId: string | null, connectionId: string, apiKey: string): Observable<EverWorksConnection> {
		return this.http.put<EverWorksConnection>(`${BASE}/connections/${encodeURIComponent(connectionId)}/key`, { apiKey }, this.org(organizationId));
	}

	pause(organizationId: string | null, connectionId: string): Observable<EverWorksConnection> {
		return this.http.post<EverWorksConnection>(`${BASE}/connections/${encodeURIComponent(connectionId)}/pause`, {}, this.org(organizationId));
	}

	resume(organizationId: string | null, connectionId: string): Observable<EverWorksConnection> {
		return this.http.post<EverWorksConnection>(`${BASE}/connections/${encodeURIComponent(connectionId)}/resume`, {}, this.org(organizationId));
	}

	registerWebhook(organizationId: string | null, connectionId: string): Observable<EverWorksConnection> {
		return this.http.post<EverWorksConnection>(`${BASE}/connections/${encodeURIComponent(connectionId)}/webhook`, {}, this.org(organizationId));
	}

	disconnect(organizationId: string | null, connectionId: string): Observable<{ success: true; webhookDeleted: boolean }> {
		return this.http.delete<{ success: true; webhookDeleted: boolean }>(`${BASE}/connections/${encodeURIComponent(connectionId)}`, this.org(organizationId));
	}

	// ── Mapping ───────────────────────────────────────────────────────────────────────────────────

	currentMapping(organizationId: string | null): Observable<EverWorksMapping | null> {
		return this.http.get<EverWorksMapping | null>(`${BASE}/mappings`, this.org(organizationId));
	}

	createMapping(organizationId: string | null, everWorksOrganizationId: string): Observable<EverWorksMapping> {
		return this.http.post<EverWorksMapping>(`${BASE}/mappings`, { everWorksOrganizationId }, this.org(organizationId));
	}

	updateMapping(organizationId: string | null, integrationTenantId: string, update: EverWorksMappingUpdate): Observable<EverWorksMapping> {
		return this.http.put<EverWorksMapping>(this.mapping(integrationTenantId), update, this.org(organizationId));
	}

	removeMapping(organizationId: string | null, integrationTenantId: string): Observable<{ success: true }> {
		return this.http.delete<{ success: true }>(this.mapping(integrationTenantId), this.org(organizationId));
	}

	// ── Match review ──────────────────────────────────────────────────────────────────────────────

	people(organizationId: string | null, integrationTenantId: string): Observable<EverWorksPeopleView> {
		return this.http.get<EverWorksPeopleView>(`${this.mapping(integrationTenantId)}/people`, this.org(organizationId));
	}

	decidePeople(organizationId: string | null, integrationTenantId: string, decision: EverWorksPeopleDecision): Observable<EverWorksPeopleView> {
		return this.http.put<EverWorksPeopleView>(`${this.mapping(integrationTenantId)}/people`, decision, this.org(organizationId));
	}

	/** Invites an unpaired Ever Works member to Gauzy (the platform's employee invitation, Employee role). */
	inviteToGauzy(organizationId: string | null, integrationTenantId: string, body: { ewUserId: string }): Observable<EverWorksInviteToGauzyResult> {
		return this.http.post<EverWorksInviteToGauzyResult>(`${this.mapping(integrationTenantId)}/people/invite-to-gauzy`, body, this.org(organizationId));
	}

	/** Invites an unpaired Gauzy person into the mapped Ever Works organization. */
	inviteToEverWorks(organizationId: string | null, integrationTenantId: string, body: { employeeId: string }): Observable<EverWorksInviteToEverWorksResult> {
		return this.http.post<EverWorksInviteToEverWorksResult>(`${this.mapping(integrationTenantId)}/people/invite-to-ever-works`, body, this.org(organizationId));
	}

	agents(organizationId: string | null, integrationTenantId: string): Observable<EverWorksAgentRow[]> {
		return this.http.get<EverWorksAgentRow[]>(`${this.mapping(integrationTenantId)}/agents`, this.org(organizationId));
	}

	teams(organizationId: string | null, integrationTenantId: string): Observable<EverWorksTeamsView> {
		return this.http.get<EverWorksTeamsView>(`${this.mapping(integrationTenantId)}/teams`, this.org(organizationId));
	}

	decideTeams(organizationId: string | null, integrationTenantId: string, decision: EverWorksTeamsDecision): Observable<EverWorksTeamsView> {
		return this.http.put<EverWorksTeamsView>(`${this.mapping(integrationTenantId)}/teams`, decision, this.org(organizationId));
	}

	projects(organizationId: string | null, integrationTenantId: string): Observable<EverWorksProjectsView> {
		return this.http.get<EverWorksProjectsView>(`${this.mapping(integrationTenantId)}/projects`, this.org(organizationId));
	}

	decideProjects(organizationId: string | null, integrationTenantId: string, decision: EverWorksProjectsDecision): Observable<EverWorksProjectsView> {
		return this.http.put<EverWorksProjectsView>(`${this.mapping(integrationTenantId)}/projects`, decision, this.org(organizationId));
	}

	initiatives(organizationId: string | null, integrationTenantId: string): Observable<EverWorksInitiativesView> {
		return this.http.get<EverWorksInitiativesView>(`${this.mapping(integrationTenantId)}/initiatives`, this.org(organizationId));
	}

	decideInitiatives(organizationId: string | null, integrationTenantId: string, decision: EverWorksInitiativesDecision): Observable<EverWorksInitiativesView> {
		return this.http.put<EverWorksInitiativesView>(`${this.mapping(integrationTenantId)}/initiatives`, decision, this.org(organizationId));
	}

	// ── Sync ──────────────────────────────────────────────────────────────────────────────────────

	preview(organizationId: string | null, integrationTenantId: string): Observable<EverWorksSyncPreview> {
		return this.http.get<EverWorksSyncPreview>(`${this.mapping(integrationTenantId)}/sync/preview`, this.org(organizationId));
	}

	startSync(organizationId: string | null, integrationTenantId: string): Observable<EverWorksSyncRun> {
		return this.http.post<EverWorksSyncRun>(`${this.mapping(integrationTenantId)}/sync/start`, {}, this.org(organizationId));
	}

	resync(organizationId: string | null, integrationTenantId: string): Observable<EverWorksSyncRun> {
		return this.http.post<EverWorksSyncRun>(`${this.mapping(integrationTenantId)}/sync/resync`, {}, this.org(organizationId));
	}

	cancelSync(organizationId: string | null, integrationTenantId: string): Observable<EverWorksSyncRun> {
		return this.http.post<EverWorksSyncRun>(`${this.mapping(integrationTenantId)}/sync/cancel`, {}, this.org(organizationId));
	}

	syncStatus(organizationId: string | null, integrationTenantId: string): Observable<EverWorksSyncStatus> {
		return this.http.get<EverWorksSyncStatus>(`${this.mapping(integrationTenantId)}/sync/status`, this.org(organizationId));
	}

	syncLog(
		organizationId: string | null,
		integrationTenantId: string,
		filter: { status?: string | null; direction?: string | null; cursor?: string | null; limit?: number } = {}
	): Observable<EverWorksPage<EverWorksSyncLogEntry>> {
		return this.http.get<EverWorksPage<EverWorksSyncLogEntry>>(
			`${this.mapping(integrationTenantId)}/sync/log`,
			this.org(organizationId, { status: filter.status, direction: filter.direction, cursor: filter.cursor, limit: filter.limit ? String(filter.limit) : null })
		);
	}

	conflicts(organizationId: string | null, integrationTenantId: string, state: 'open' | 'resolved' | 'all' = 'open', cursor?: string | null): Observable<EverWorksPage<EverWorksConflict>> {
		return this.http.get<EverWorksPage<EverWorksConflict>>(`${this.mapping(integrationTenantId)}/conflicts`, this.org(organizationId, { state, cursor }));
	}

	resolveConflict(organizationId: string | null, integrationTenantId: string, conflictId: string, resolution: 'keep' | 'use_other'): Observable<EverWorksConflict> {
		return this.http.post<EverWorksConflict>(
			`${this.mapping(integrationTenantId)}/conflicts/${encodeURIComponent(conflictId)}/resolve`,
			{ resolution },
			this.org(organizationId)
		);
	}
}
