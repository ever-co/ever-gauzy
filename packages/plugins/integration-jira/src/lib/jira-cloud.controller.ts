import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Logger, NotFoundException, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ID, IIntegrationTenant, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, RequestContext, TenantPermissionGuard, UUIDValidationPipe, UseValidationPipe } from '@gauzy/core';
import { accessibleJiraSites, JiraSite } from './client/jira-api.client';
import {
	CreateJiraMappingDTO,
	JiraConflictsQueryDTO,
	JiraImportDTO,
	JiraInstallStateDTO,
	JiraRunsQueryDTO,
	JiraStatusQueryDTO,
	ResolveJiraConflictDTO,
	SelectJiraSiteDTO,
	UpdateJiraMappingDTO
} from './dto/jira.dto';
import { JiraProjectMapping, JiraSyncDirection } from './entities/jira-project-mapping.entity';
import { JiraSyncConflict } from './entities/jira-sync-conflict.entity';
import { JiraSyncRun } from './entities/jira-sync-run.entity';
import { isJiraConfigured, JiraCloudConfig, jiraWebhooksEnabled } from './jira-config';
import { JiraMappingService } from './jira-mapping.service';
import { JiraOAuthStateService } from './jira-oauth-state.service';
import { JiraSyncConflictService } from './jira-sync-conflict.service';
import { JiraSyncRunReport, JiraSyncRunService, parseRunReport } from './jira-sync-run.service';
import { JiraConnectionSummary, JiraTenantService } from './jira-tenant.service';
import {
	JIRA_CONFIG,
	JIRA_MAPPING_NOT_INBOUND,
	JIRA_NOT_CONFIGURED,
	JIRA_NOT_CONNECTED,
	JIRA_OAUTH_AUDIENCE,
	JIRA_OAUTH_SCOPES,
	JIRA_ROUTE_PREFIX,
	JIRA_SITE_HAS_MAPPINGS,
	JIRA_SITE_NOT_FOUND
} from './jira.constants';
import { JiraSyncService } from './sync/jira-sync.service';
import { DEFAULT_STATUS_MAP, parseIssueTypeIds, parseStatusMap } from './sync/jira-issue.mapper';
import { JiraWebhookOutcome, JiraWebhookService } from './sync/jira-webhook.service';

/** What a mapping route answers: the row with its status map and issue types resolved. */
export interface JiraMappingView extends Omit<JiraProjectMapping, 'statusMap' | 'issueTypeIds'> {
	statusMap: Record<string, string>;
	issueTypeIds: string[];
}

export function mappingView(mapping: JiraProjectMapping): JiraMappingView {
	return { ...mapping, statusMap: parseStatusMap(mapping.statusMap), issueTypeIds: parseIssueTypeIds(mapping.issueTypeIds) ?? [] } as JiraMappingView;
}

/** What a run route answers: the row with its report read and how many conflicts it found. */
export type JiraRunView = Omit<JiraSyncRun, 'report'> & { report: JiraSyncRunReport | null; conflictCount: number };

/**
 * The management routes of the Jira integration (`/integration/jira`): connect (the state of the OAuth flow), the
 * connection's status and site, the Jira projects with their issue types and statuses, the project ↔ project
 * mappings, imports and runs, the webhook, and the sync conflicts. Every route is tenant-scoped by the platform's
 * guards; a connection is reached only by its id in the caller's tenant.
 */
@ApiTags('Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller(JIRA_ROUTE_PREFIX)
export class JiraCloudController {
	private readonly logger = new Logger(JiraCloudController.name);

	constructor(
		@Inject(JIRA_CONFIG) private readonly config: JiraCloudConfig,
		private readonly tenants: JiraTenantService,
		private readonly mappings: JiraMappingService,
		private readonly runs: JiraSyncRunService,
		private readonly sync: JiraSyncService,
		private readonly webhooks: JiraWebhookService,
		private readonly oauthState: JiraOAuthStateService,
		private readonly conflicts: JiraSyncConflictService
	) {}

	/** Whether the OAuth app is configured and webhooks can be taken, and the organization's connection if any. */
	@ApiOperation({ summary: 'The Jira integration status of an organization' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/status')
	@UseValidationPipe({ whitelist: true, transform: true })
	async status(
		@Query() query: JiraStatusQueryDTO
	): Promise<{ configured: boolean; webhooks: boolean; defaultStatusMap: Record<string, string>; connection: JiraConnectionSummary | null }> {
		const tenant = await this.tenants.forOrganization(query.organizationId);
		return {
			configured: isJiraConfigured(this.config),
			webhooks: jiraWebhooksEnabled(this.config),
			defaultStatusMap: { ...DEFAULT_STATUS_MAP },
			connection: tenant ? this.tenants.summaryOf(tenant) : null
		};
	}

	/** Starts the connect flow: a single-use state bound to the caller's tenant and the organization, and where to send them. */
	@ApiOperation({ summary: 'Start the Jira connect flow' })
	@Post('/install/state')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true, transform: true })
	async installState(@Body() body: JiraInstallStateDTO): Promise<{ state: string; authorizeUrl: string }> {
		if (!isJiraConfigured(this.config)) {
			throw new BadRequestException({ message: 'The Jira OAuth app is not configured on this server', code: JIRA_NOT_CONFIGURED });
		}
		const tenantId = RequestContext.currentTenantId() as ID;
		const userId = RequestContext.currentUserId() as ID;
		// The organization is the caller's (the DTO checked it, as an id or as an object); the state binds the callback to
		// it and to this tenant.
		const organizationId = (body.organizationId ?? (body as { organization?: { id?: ID } }).organization?.id) as ID | undefined;
		if (!organizationId) {
			throw new BadRequestException({ message: 'An organization is required', code: JIRA_NOT_CONNECTED });
		}
		const state = await this.oauthState.create({ tenantId, organizationId, userId });
		return { state, authorizeUrl: jiraAuthorizeUrlOf(this.config, state) };
	}

	@ApiOperation({ summary: 'A Jira connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId')
	async connection(@Param('integrationId', UUIDValidationPipe) integrationId: ID): Promise<JiraConnectionSummary> {
		return this.tenants.summaryOf(await this.tenants.requireById(integrationId));
	}

	/** Disconnects: the connection's webhook is removed from Jira first (best effort), then the connection and its mappings. */
	@ApiOperation({ summary: 'Disconnect Jira from the organization' })
	@Permissions(PermissionsEnum.INTEGRATION_DELETE)
	@Delete('/:integrationId')
	@HttpCode(HttpStatus.NO_CONTENT)
	async disconnect(@Param('integrationId', UUIDValidationPipe) integrationId: ID): Promise<void> {
		const tenant = await this.tenants.requireById(integrationId);
		await this.webhooks.remove(tenant);
		await this.tenants.disconnect(tenant);
	}

	/** The Jira Cloud sites the connection's token reaches (one is the connection's). */
	@ApiOperation({ summary: 'The Jira sites the connection may work with' })
	@Get('/:integrationId/sites')
	async sites(@Param('integrationId', UUIDValidationPipe) integrationId: ID): Promise<Array<JiraSite & { selected: boolean }>> {
		const tenant = await this.tenants.requireById(integrationId);
		const current = this.tenants.summaryOf(tenant).cloudId;
		const sites = await accessibleJiraSites(await this.tenants.accessTokenReady(tenant), { apiUrl: this.config.apiUrl });
		return sites.map((site) => ({ ...site, selected: site.id === current }));
	}

	/**
	 * Chooses the connection's site: one of the sites its token reaches. Moving to another site removes the webhook of
	 * the former one; the webhook of the new one is registered behind the answer. A connection that has mappings keeps
	 * its site (409 `JIRA_SITE_HAS_MAPPINGS`): a mapping names its Jira project by an id that is unique only on its site,
	 * so on another site it could name another project. Its mappings are removed first.
	 */
	@ApiOperation({ summary: 'Choose the Jira site of a connection' })
	@Put('/:integrationId/site')
	@UseValidationPipe({ whitelist: true })
	async selectSite(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Body() body: SelectJiraSiteDTO): Promise<JiraConnectionSummary> {
		const tenant = await this.tenants.requireById(integrationId);
		const sites = await accessibleJiraSites(await this.tenants.accessTokenReady(tenant), { apiUrl: this.config.apiUrl });
		const site = sites.find((candidate) => candidate.id === body.cloudId);
		if (!site) throw new NotFoundException({ message: 'The connection cannot reach that Jira site', code: JIRA_SITE_NOT_FOUND });
		const myself = await this.tenants.clientForSite(tenant, site.id).myself();
		// Checked and written while no mapping can be created: one made meanwhile for the former site never stays behind.
		// The connection is read again under the lock: a site another request chose meanwhile is the current one.
		const chosen = await this.mappings.whileMappingsLocked(tenant, async (mappings, synced) => {
			const fresh = (await this.tenants.findAnyById(tenant.id as ID)) ?? tenant;
			const current = this.tenants.summaryOf(fresh).cloudId;
			const moving = current !== site.id;
			if (moving && mappings > 0) {
				throw new ConflictException({ message: 'A connection with mappings keeps its Jira site; remove its mappings first', code: JIRA_SITE_HAS_MAPPINGS });
			}
			// Issues it synced name Jira issue ids of the former site (their id maps stay when the mappings go), and so does a
			// run still writing them: another site's issue with the same id would update the wrong task. Moved by a
			// disconnect and a new connection, once no run is live.
			if (moving && current && synced) {
				throw new ConflictException({
					message: 'This connection has synced issues of its Jira site; disconnect it and connect again to work with another site',
					code: JIRA_SITE_HAS_MAPPINGS
				});
			}
			if (moving && current) await this.webhooks.remove(fresh);
			return this.tenants.selectSite(fresh, site, myself);
		});
		this.ensureWebhookLater(chosen);
		return this.tenants.summaryOf(chosen);
	}

	/** Who the token is on the connection's site. */
	@ApiOperation({ summary: 'The Jira account and site of a connection' })
	@Get('/:integrationId/metadata')
	async metadata(@Param('integrationId', UUIDValidationPipe) integrationId: ID) {
		const tenant = await this.tenants.requireById(integrationId);
		const myself = await (await this.tenants.clientReady(tenant)).myself();
		const summary = this.tenants.summaryOf(tenant);
		return { account: myself, site: { id: summary.cloudId, url: summary.siteUrl, name: summary.siteName } };
	}

	@ApiOperation({ summary: 'The Jira projects the connection may see' })
	@Get('/:integrationId/projects')
	async projects(@Param('integrationId', UUIDValidationPipe) integrationId: ID) {
		const tenant = await this.tenants.requireById(integrationId);
		return (await this.tenants.clientReady(tenant)).projects();
	}

	@ApiOperation({ summary: 'A Jira project with its issue types and statuses' })
	@Get('/:integrationId/projects/:projectId')
	async project(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Param('projectId') projectId: string) {
		const tenant = await this.tenants.requireById(integrationId);
		const key = String(projectId).slice(0, 64);
		if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new BadRequestException({ message: 'The Jira project was not found' });
		const project = await (await this.tenants.clientReady(tenant)).project(key);
		if (!project) throw new NotFoundException({ message: 'The Jira project was not found' });
		return project;
	}

	@ApiOperation({ summary: 'The Jira project ↔ project mappings of a connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId/mappings')
	async listMappings(@Param('integrationId', UUIDValidationPipe) integrationId: ID): Promise<JiraMappingView[]> {
		const tenant = await this.tenants.requireById(integrationId);
		return (await this.mappings.list(tenant)).map(mappingView);
	}

	/** Maps a Jira project to a project; the connection's webhook follows behind the answer (best effort). */
	@ApiOperation({ summary: 'Map a Jira project to a project' })
	@Post('/:integrationId/mappings')
	@UseValidationPipe({ whitelist: true })
	async createMapping(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Body() body: CreateJiraMappingDTO): Promise<JiraMappingView> {
		const tenant = await this.tenants.requireById(integrationId);
		// A mapping names its Jira project by an id of the connection's site: none before a site is chosen (400
		// `JIRA_SITE_REQUIRED`), and none on a site changed while this request ran (409 `JIRA_SITE_CHANGED`).
		this.tenants.clientFor(tenant);
		const cloudId = this.tenants.summaryOf(tenant).cloudId as string;
		const mapping = mappingView(await this.mappings.createMapping(tenant, body, cloudId));
		this.ensureWebhookLater(tenant);
		return mapping;
	}

	@ApiOperation({ summary: 'Change a mapping' })
	@Put('/:integrationId/mappings/:mappingId')
	@UseValidationPipe({ whitelist: true })
	async updateMapping(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID,
		@Param('mappingId', UUIDValidationPipe) mappingId: ID,
		@Body() body: UpdateJiraMappingDTO
	): Promise<JiraMappingView> {
		const tenant = await this.tenants.requireById(integrationId);
		const mapping = mappingView(await this.mappings.updateMapping(tenant, mappingId, body));
		this.ensureWebhookLater(tenant);
		return mapping;
	}

	@ApiOperation({ summary: 'Remove a mapping (its tasks stay)' })
	@Delete('/:integrationId/mappings/:mappingId')
	@HttpCode(HttpStatus.NO_CONTENT)
	async removeMapping(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Param('mappingId', UUIDValidationPipe) mappingId: ID): Promise<void> {
		const tenant = await this.tenants.requireById(integrationId);
		await this.mappings.removeMapping(tenant, mappingId);
		this.ensureWebhookLater(tenant);
	}

	/**
	 * Starts an import of the mapping's issues: the mapping is claimed first (one run at a time, 409 while one is live),
	 * the run is answered at once, and the import goes on behind the response. A mapping that brings nothing in
	 * (switched off, or outbound only) is not imported (409 `JIRA_MAPPING_NOT_INBOUND`), as the scheduled import skips it.
	 */
	@ApiOperation({ summary: 'Import the issues of a mapped Jira project now' })
	@Post('/:integrationId/mappings/:mappingId/import')
	@HttpCode(HttpStatus.ACCEPTED)
	@UseValidationPipe({ whitelist: true })
	async importNow(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID,
		@Param('mappingId', UUIDValidationPipe) mappingId: ID,
		@Body() body: JiraImportDTO
	): Promise<{ accepted: true; run: JiraSyncRun }> {
		const tenant = await this.tenants.requireById(integrationId);
		// A connection waiting for its site cannot import: answered now (400 `JIRA_SITE_REQUIRED`), not in the run.
		this.tenants.clientFor(tenant);
		const mapping = await this.mappings.requireOne(tenant, mappingId);
		if (!mapping.syncEnabled || mapping.direction === JiraSyncDirection.OUTBOUND) {
			throw new ConflictException({ message: 'This mapping brings no issues in (it is switched off, or sends tasks out only)', code: JIRA_MAPPING_NOT_INBOUND });
		}
		const requestedByUserId = RequestContext.currentUserId() as ID;
		const full = !!body.full;
		const run = await this.runs.claimImport(tenant, mapping, { full, requestedByUserId });
		// The import outlives the response: it opens a request context of its own (see `runInJiraContext`).
		setImmediate(() => {
			this.sync.importMapping(tenant, mapping, run, { full }).catch((error: unknown) => {
				this.logger.warn(`Import of mapping ${mapping.id} failed to start: ${error instanceof Error ? error.message : String(error)}`);
			});
		});
		return { accepted: true, run };
	}

	/** Brings the connection's webhook in line with its mappings now (after a failed registration, or once webhooks are configured). */
	@ApiOperation({ summary: 'Register the webhook of a connection again' })
	@Post('/:integrationId/webhook')
	@HttpCode(HttpStatus.OK)
	async ensureWebhook(@Param('integrationId', UUIDValidationPipe) integrationId: ID): Promise<{ outcome: JiraWebhookOutcome; connection: JiraConnectionSummary }> {
		const tenant = await this.tenants.requireById(integrationId);
		const outcome = await this.webhooks.ensure(tenant);
		return { outcome, connection: this.tenants.summaryOf(tenant) };
	}

	/** The latest runs, each with its report and how many conflicts it found (the sync log). */
	@ApiOperation({ summary: 'The latest runs of a connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId/runs')
	@UseValidationPipe({ whitelist: true, transform: true })
	async listRuns(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Query() query: JiraRunsQueryDTO): Promise<JiraRunView[]> {
		const tenant = await this.tenants.requireById(integrationId);
		const runs = await this.runs.list(tenant, query.take ?? 50);
		const counts = await this.conflicts.countByRun(tenant, runs.map((run) => run.id as ID));
		return runs.map((run) => ({ ...run, report: parseRunReport(run.report), conflictCount: counts.get(String(run.id)) ?? 0 }) as JiraRunView);
	}

	/** The fields changed both in Jira and on the platform to different values: Jira's value was applied, the task's is kept in the record. Open ones by default. */
	@ApiOperation({ summary: 'The sync conflicts of a connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId/conflicts')
	@UseValidationPipe({ whitelist: true, transform: true })
	async listConflicts(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Query() query: JiraConflictsQueryDTO): Promise<JiraSyncConflict[]> {
		const tenant = await this.tenants.requireById(integrationId);
		return this.conflicts.list(tenant, query);
	}

	/**
	 * Resolves a conflict: `keep: external` leaves Jira's value; `keep: platform` writes the task's value back (and a
	 * mapping that sends changes out sends it to the issue). 409 when the task changed since.
	 */
	@ApiOperation({ summary: 'Resolve a sync conflict' })
	@Post('/:integrationId/conflicts/:conflictId/resolve')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true })
	async resolveConflict(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID,
		@Param('conflictId', UUIDValidationPipe) conflictId: ID,
		@Body() body: ResolveJiraConflictDTO
	): Promise<JiraSyncConflict> {
		const tenant = await this.tenants.requireById(integrationId);
		return this.conflicts.resolve(tenant, conflictId, body.keep, (RequestContext.currentUserId() as ID) ?? null);
	}

	/** The connection's webhook follows a change of its mappings or site, behind the answer (best effort). */
	private ensureWebhookLater(tenant: IIntegrationTenant): void {
		setImmediate(() => {
			this.webhooks.ensure(tenant).catch((error: unknown) => {
				this.logger.warn(`The webhook of connection ${tenant.id} could not be kept: ${error instanceof Error ? error.message : String(error)}`);
			});
		});
	}
}

/** Atlassian's authorization address for a connect flow: the gateway audience, the scopes, the callback and the state. */
export function jiraAuthorizeUrlOf(config: JiraCloudConfig, state: string): string {
	const params = new URLSearchParams({
		audience: JIRA_OAUTH_AUDIENCE,
		client_id: config.clientId as string,
		scope: JIRA_OAUTH_SCOPES.join(' '),
		redirect_uri: config.redirectUrl as string,
		state,
		response_type: 'code',
		prompt: 'consent'
	});
	return `${config.authorizeUrl}?${params.toString()}`;
}
