import { BadGatewayException, BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Logger, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, RequestContext, TenantPermissionGuard, UUIDValidationPipe, UseValidationPipe } from '@gauzy/core';
import { AsanaApiClient, AsanaApiError } from './client/asana-api.client';
import { AsanaImportDTO, AsanaInstallStateDTO, AsanaRunsQueryDTO, AsanaConflictsQueryDTO, ResolveAsanaConflictDTO, AsanaStatusQueryDTO, CreateAsanaMappingDTO, UpdateAsanaMappingDTO } from './dto/asana.dto';
import { AsanaSyncConflict } from './entities/asana-sync-conflict.entity';
import { AsanaSyncRun } from './entities/asana-sync-run.entity';
import { AsanaProjectMapping, AsanaSyncDirection } from './entities/asana-project-mapping.entity';
import { AsanaConfig, isAsanaConfigured } from './asana-config';
import { AsanaMappingService } from './asana-mapping.service';
import { AsanaOAuthStateService } from './asana-oauth-state.service';
import { AsanaSyncConflictService } from './asana-sync-conflict.service';
import { AsanaSyncRunService } from './asana-sync-run.service';
import { AsanaConnectionSummary, AsanaTenantService } from './asana-tenant.service';
import { ASANA_CONFIG, ASANA_MAPPING_NOT_INBOUND, ASANA_NOT_CONFIGURED, ASANA_NOT_CONNECTED, ASANA_OAUTH_AUTHORIZE_URL, ASANA_REQUEST_REFUSED, ASANA_ROUTE_PREFIX, ASANA_TOKEN_REFUSED, ASANA_UNAVAILABLE, ASANA_WEBHOOK_NOT_REMOVED, AsanaSettingName } from './asana.constants';
import { AsanaSyncService } from './sync/asana-sync.service';
import { parseSectionMap } from './sync/asana-task.mapper';

/** What a mapping route answers: the row with its section map resolved and the webhook secret left out. */
export interface AsanaMappingView extends Omit<AsanaProjectMapping, 'sectionMap' | 'webhookSecret' | 'webhookHandshakeToken' | 'webhookHandshakeStartedAt'> {
	sectionMap: Record<string, string>;
	hasWebhook: boolean;
}

function mappingView(mapping: AsanaProjectMapping): AsanaMappingView {
	const { webhookSecret: _secret, webhookHandshakeToken: _token, webhookHandshakeStartedAt: _started, ...rest } = mapping;
	return { ...rest, sectionMap: parseSectionMap(mapping.sectionMap), hasWebhook: !!mapping.webhookGid } as AsanaMappingView;
}

/**
 * The management routes of the Asana integration (`/integration/asana`): connect (the state of the OAuth
 * flow), the connection's status, the workspaces and their projects, a project's sections, the project ↔
 * project mappings, imports and runs. Every route is tenant-scoped by the platform's guards.
 */
@ApiTags('Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller(ASANA_ROUTE_PREFIX)
export class AsanaController {
	private readonly logger = new Logger(AsanaController.name);

	constructor(
		@Inject(ASANA_CONFIG) private readonly config: AsanaConfig,
		private readonly tenants: AsanaTenantService,
		private readonly mappings: AsanaMappingService,
		private readonly runs: AsanaSyncRunService,
		private readonly sync: AsanaSyncService,
		private readonly conflicts: AsanaSyncConflictService,
		private readonly oauthState: AsanaOAuthStateService
	) {}

	/**
	 * A read of Asana for a route: Asana's own refusals are answered as such — a refused token is recorded on the
	 * connection (the page then asks for a reconnect) and answered 400 `ASANA_TOKEN_REFUSED`; anything else Asana
	 * answered (a rate limit, an outage) is 502 `ASANA_UNAVAILABLE`, not a 500 that says nothing.
	 */
	private async asana<T>(tenant: Parameters<AsanaTenantService['clientReady']>[0], make: (client: AsanaApiClient) => Promise<T>): Promise<T> {
		try {
			return await make(await this.tenants.clientReady(tenant));
		} catch (error) {
			if (error instanceof AsanaApiError) {
				if (error.isUnauthorized) {
					await this.tenants.setAttention(tenant, 'token_refused', this.tenants.settingsOf(tenant)[AsanaSettingName.ACCESS_TOKEN] ?? null);
					throw new BadRequestException({ message: 'Asana refused the connection\'s token; connect again', code: ASANA_TOKEN_REFUSED });
				}
				// The user lacks access to that one resource, or it is gone: the request's refusal, not the connection's.
				if (error.isForbidden || error.isNotFound) {
					throw new BadRequestException({ message: `Asana refused the request: ${error.message}`, code: ASANA_REQUEST_REFUSED });
				}
				throw new BadGatewayException({ message: `Asana did not answer: ${error.message}`, code: ASANA_UNAVAILABLE });
			}
			throw error;
		}
	}

	/** Whether the OAuth application is configured, and the organization's connection if any. */
	@ApiOperation({ summary: 'The Asana integration status of an organization' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/status')
	@UseValidationPipe({ whitelist: true, transform: true })
	async status(@Query() query: AsanaStatusQueryDTO): Promise<{ configured: boolean; webhooks: boolean; connection: AsanaConnectionSummary | null }> {
		const tenant = await this.tenants.forOrganization(query.organizationId as ID);
		return { configured: isAsanaConfigured(this.config), webhooks: !!this.config.webhookBaseUrl, connection: tenant ? this.tenants.summaryOf(tenant) : null };
	}

	/** Starts the connect flow: a single-use state bound to the caller's tenant and organization, and where to send them. */
	@ApiOperation({ summary: 'Start the Asana connect flow' })
	@Post('/install/state')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true, transform: true })
	async installState(@Body() body: AsanaInstallStateDTO): Promise<{ state: string; authorizeUrl: string }> {
		if (!isAsanaConfigured(this.config)) {
			throw new BadRequestException({ message: 'The Asana OAuth application is not configured on this server', code: ASANA_NOT_CONFIGURED });
		}
		const tenantId = RequestContext.currentTenantId() as ID;
		const userId = RequestContext.currentUserId() as ID;
		const organizationId = (body.organizationId ?? (body as { organization?: { id?: ID } }).organization?.id) as ID | undefined;
		if (!organizationId) {
			throw new BadRequestException({ message: 'An organization is required', code: ASANA_NOT_CONNECTED });
		}
		const state = await this.oauthState.create({ tenantId, organizationId, userId });
		const params = new URLSearchParams({
			client_id: this.config.clientId as string,
			redirect_uri: this.config.redirectUrl as string,
			response_type: 'code',
			state
		});
		return { state, authorizeUrl: `${ASANA_OAUTH_AUTHORIZE_URL}?${params.toString()}` };
	}

	@ApiOperation({ summary: 'An Asana connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId')
	async connection(@Param('integrationId', UUIDValidationPipe) integrationId: ID): Promise<AsanaConnectionSummary> {
		return this.tenants.summaryOf(await this.tenants.requireById(integrationId));
	}

	@ApiOperation({ summary: 'Disconnect Asana from the organization' })
	@Permissions(PermissionsEnum.INTEGRATION_DELETE)
	@Delete('/:integrationId')
	@HttpCode(HttpStatus.NO_CONTENT)
	async disconnect(@Param('integrationId', UUIDValidationPipe) integrationId: ID): Promise<void> {
		const tenant = await this.tenants.requireById(integrationId);
		for (const mapping of await this.mappings.list(tenant)) {
			await this.sync.removeWebhook(tenant, mapping);
		}
		await this.tenants.disconnect(tenant);
	}

	/** Who the token is, and the workspaces it opens. */
	@ApiOperation({ summary: 'The Asana user and workspaces of a connection' })
	@Get('/:integrationId/metadata')
	async metadata(@Param('integrationId', UUIDValidationPipe) integrationId: ID) {
		const tenant = await this.tenants.requireById(integrationId);
		const me = await this.asana(tenant, (client) => client.me());
		return { user: { gid: me.gid, name: me.name, email: me.email }, workspaces: me.workspaces };
	}

	@ApiOperation({ summary: 'The projects of an Asana workspace' })
	@Get('/:integrationId/workspaces/:workspaceGid/projects')
	async projects(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Param('workspaceGid') workspaceGid: string) {
		const tenant = await this.tenants.requireById(integrationId);
		const projects = await this.asana(tenant, (client) => client.projects(String(workspaceGid).slice(0, 64)));
		return projects.filter((project) => !project.archived);
	}

	@ApiOperation({ summary: 'The sections of an Asana project' })
	@Get('/:integrationId/projects/:projectGid/sections')
	async sections(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Param('projectGid') projectGid: string) {
		const tenant = await this.tenants.requireById(integrationId);
		return this.asana(tenant, (client) => client.sections(String(projectGid).slice(0, 64)));
	}

	@ApiOperation({ summary: 'The Asana project ↔ project mappings of a connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId/mappings')
	async listMappings(@Param('integrationId', UUIDValidationPipe) integrationId: ID): Promise<AsanaMappingView[]> {
		const tenant = await this.tenants.requireById(integrationId);
		return (await this.mappings.list(tenant)).map(mappingView);
	}

	/** Maps an Asana project to a project; the webhook is registered behind the answer (best effort). */
	@ApiOperation({ summary: 'Map an Asana project to a project' })
	@Post('/:integrationId/mappings')
	@UseValidationPipe({ whitelist: true })
	async createMapping(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Body() body: CreateAsanaMappingDTO): Promise<AsanaMappingView> {
		const tenant = await this.tenants.requireById(integrationId);
		const mapping = await this.mappings.createMapping(tenant, body);
		setImmediate(() => {
			this.sync.ensureWebhook(tenant, mapping).catch((error: unknown) => {
				this.logger.warn(`The webhook of mapping ${mapping.id} could not be registered: ${error instanceof Error ? error.message : String(error)}`);
			});
		});
		return mappingView(mapping);
	}

	@ApiOperation({ summary: 'Change a mapping' })
	@Put('/:integrationId/mappings/:mappingId')
	@UseValidationPipe({ whitelist: true })
	async updateMapping(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID,
		@Param('mappingId', UUIDValidationPipe) mappingId: ID,
		@Body() body: UpdateAsanaMappingDTO
	): Promise<AsanaMappingView> {
		const tenant = await this.tenants.requireById(integrationId);
		return mappingView(await this.mappings.updateMapping(tenant, mappingId, body));
	}

	@ApiOperation({ summary: 'Remove a mapping (its tasks stay)' })
	@Delete('/:integrationId/mappings/:mappingId')
	@HttpCode(HttpStatus.NO_CONTENT)
	async removeMapping(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Param('mappingId', UUIDValidationPipe) mappingId: ID): Promise<void> {
		const tenant = await this.tenants.requireById(integrationId);
		const mapping = await this.mappings.requireOne(tenant, mappingId);
		await this.sync.removeWebhook(tenant, mapping);
		await this.mappings.removeMapping(tenant, mappingId);
	}

	/** Registers the mapping's webhook again (after a missed handshake, or once the public address is set). */
	@ApiOperation({ summary: 'Register the webhook of a mapping again' })
	@Post('/:integrationId/mappings/:mappingId/webhook')
	@HttpCode(HttpStatus.ACCEPTED)
	async registerWebhook(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Param('mappingId', UUIDValidationPipe) mappingId: ID): Promise<{ accepted: true }> {
		if (!this.config.webhookBaseUrl) {
			throw new BadRequestException({ message: 'This server has no public address for Asana webhooks', code: ASANA_NOT_CONFIGURED });
		}
		const tenant = await this.tenants.requireById(integrationId);
		const mapping = await this.mappings.requireOne(tenant, mappingId);
		// The current webhook must be gone before it is forgotten: one Asana still delivers to is not left untracked.
		if (!(await this.sync.removeWebhook(tenant, mapping))) {
			throw new BadGatewayException({ message: 'The current Asana webhook could not be removed; try again', code: ASANA_WEBHOOK_NOT_REMOVED });
		}
		await this.mappings.recordWebhook(mapping, { gid: null, secret: null });
		setImmediate(() => void this.sync.ensureWebhook(tenant, mapping));
		return { accepted: true };
	}

	/** Starts an import of the mapping's tasks: the mapping is claimed first (409 while one is live), the run answered at once. */
	@ApiOperation({ summary: 'Import the tasks of a mapped Asana project now' })
	@Post('/:integrationId/mappings/:mappingId/import')
	@HttpCode(HttpStatus.ACCEPTED)
	@UseValidationPipe({ whitelist: true })
	async importNow(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID,
		@Param('mappingId', UUIDValidationPipe) mappingId: ID,
		@Body() body: AsanaImportDTO
	): Promise<{ accepted: true; run: AsanaSyncRun }> {
		const tenant = await this.tenants.requireById(integrationId);
		const mapping = await this.mappings.requireOne(tenant, mappingId);
		// The same rule as the webhook path: an outbound or switched-off mapping brings nothing in.
		if (mapping.direction === AsanaSyncDirection.OUTBOUND || !mapping.syncEnabled) {
			throw new BadRequestException({ message: 'This mapping does not import tasks (it is outbound, or its sync is off)', code: ASANA_MAPPING_NOT_INBOUND });
		}
		const requestedByUserId = RequestContext.currentUserId() as ID;
		const full = !!body.full;
		const run = await this.runs.claimImport(tenant, mapping, { full, requestedByUserId });
		setImmediate(() => {
			this.sync.importMapping(tenant, mapping, run, { full }).catch((error: unknown) => {
				this.logger.warn(`Import of mapping ${mapping.id} failed to start: ${error instanceof Error ? error.message : String(error)}`);
			});
		});
		return { accepted: true, run };
	}

	@ApiOperation({ summary: 'The latest runs of a connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId/runs')
	@UseValidationPipe({ whitelist: true, transform: true })
	async listRuns(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Query() query: AsanaRunsQueryDTO): Promise<Array<AsanaSyncRun & { conflictCount: number }>> {
		const tenant = await this.tenants.requireById(integrationId);
		const runs = await this.runs.list(tenant, query.take ?? 50);
		// Each run with how many conflicts it found (the sync log).
		const counts = await this.conflicts.countByRun(tenant, runs.map((run) => run.id as ID));
		return runs.map((run) => Object.assign(run, { conflictCount: counts.get(String(run.id)) ?? 0 }));
	}

	/**
	 * The fields changed both in Asana and on the platform to different values: Asana's value was applied, the
	 * task's is kept in the record. Open ones by default.
	 */
	@ApiOperation({ summary: 'The sync conflicts of a connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId/conflicts')
	@UseValidationPipe({ whitelist: true, transform: true })
	async listConflicts(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Query() query: AsanaConflictsQueryDTO): Promise<AsanaSyncConflict[]> {
		const tenant = await this.tenants.requireById(integrationId);
		return this.conflicts.list(tenant, query);
	}

	/**
	 * Resolves a conflict: `keep: external` leaves Asana's value; `keep: platform` writes the task's value back
	 * (and a mapping that sends changes out sends it to the task). 409 when the task changed since.
	 */
	@ApiOperation({ summary: 'Resolve a sync conflict' })
	@Post('/:integrationId/conflicts/:conflictId/resolve')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true })
	async resolveConflict(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID,
		@Param('conflictId', UUIDValidationPipe) conflictId: ID,
		@Body() body: ResolveAsanaConflictDTO
	): Promise<AsanaSyncConflict> {
		const tenant = await this.tenants.requireById(integrationId);
		return this.conflicts.resolve(tenant, conflictId, body.keep, (RequestContext.currentUserId() as ID) ?? null);
	}
}
