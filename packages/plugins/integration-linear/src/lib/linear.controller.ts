import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Logger,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, RequestContext, TenantPermissionGuard, UUIDValidationPipe, UseValidationPipe } from '@gauzy/core';
import {
	CreateLinearMappingDTO,
	LinearConflictsQueryDTO,
	LinearImportDTO,
	LinearInstallStateDTO,
	LinearRunsQueryDTO,
	LinearStatusQueryDTO,
	ResolveLinearConflictDTO,
	UpdateLinearMappingDTO
} from './dto/linear.dto';
import { LinearSyncConflict } from './entities/linear-sync-conflict.entity';
import { LinearSyncRun } from './entities/linear-sync-run.entity';
import { LinearTeamMapping } from './entities/linear-team-mapping.entity';
import { isLinearConfigured, LinearConfig } from './linear-config';
import { LinearMappingService } from './linear-mapping.service';
import { LinearOAuthStateService } from './linear-oauth-state.service';
import { LinearSyncConflictService } from './linear-sync-conflict.service';
import { LinearSyncRunService } from './linear-sync-run.service';
import { LinearConnectionSummary, LinearTenantService } from './linear-tenant.service';
import { LINEAR_CONFIG, LINEAR_NOT_CONFIGURED, LINEAR_NOT_CONNECTED, LINEAR_OAUTH_AUTHORIZE_URL, LINEAR_OAUTH_SCOPES, LINEAR_ROUTE_PREFIX } from './linear.constants';
import { LinearSyncService } from './sync/linear-sync.service';
import { DEFAULT_STATE_MAP, parseStateMap } from './sync/linear-issue.mapper';

/** What a mapping route answers: the row with its state map resolved. */
export interface LinearMappingView extends Omit<LinearTeamMapping, 'stateMap'> {
	stateMap: Record<string, string>;
}

function mappingView(mapping: LinearTeamMapping): LinearMappingView {
	return { ...mapping, stateMap: parseStateMap(mapping.stateMap) } as LinearMappingView;
}

/**
 * The management routes of the Linear integration (`/integration/linear`): connect (the state of the
 * OAuth flow), the connection's status, the Linear teams, the team ↔ project mappings, imports and runs.
 * Every route is tenant-scoped by the platform's guards; a connection is reached only by its id in the
 * caller's tenant.
 */
@ApiTags('Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller(LINEAR_ROUTE_PREFIX)
export class LinearController {
	private readonly logger = new Logger(LinearController.name);

	constructor(
		@Inject(LINEAR_CONFIG) private readonly config: LinearConfig,
		private readonly tenants: LinearTenantService,
		private readonly mappings: LinearMappingService,
		private readonly runs: LinearSyncRunService,
		private readonly sync: LinearSyncService,
		private readonly oauthState: LinearOAuthStateService,
		private readonly conflicts: LinearSyncConflictService
	) {}

	/** Whether the OAuth application is configured, and the organization's connection if any. */
	@ApiOperation({ summary: 'The Linear integration status of an organization' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/status')
	@UseValidationPipe({ whitelist: true, transform: true })
	async status(@Query() query: LinearStatusQueryDTO): Promise<{ configured: boolean; defaultStateMap: Record<string, string>; connection: LinearConnectionSummary | null }> {
		const tenant = await this.tenants.forOrganization(query.organizationId);
		return { configured: isLinearConfigured(this.config), defaultStateMap: DEFAULT_STATE_MAP, connection: tenant ? this.tenants.summaryOf(tenant) : null };
	}

	/** Starts the connect flow: a single-use state bound to the caller's tenant and the organization, and where to send them. */
	@ApiOperation({ summary: 'Start the Linear connect flow' })
	@Post('/install/state')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true, transform: true })
	async installState(@Body() body: LinearInstallStateDTO): Promise<{ state: string; authorizeUrl: string }> {
		if (!isLinearConfigured(this.config)) {
			throw new BadRequestException({ message: 'The Linear OAuth application is not configured on this server', code: LINEAR_NOT_CONFIGURED });
		}
		const tenantId = RequestContext.currentTenantId() as ID;
		const userId = RequestContext.currentUserId() as ID;
		// The organization is the caller's (the DTO checked it, as an id or as an object); the state binds the
		// callback to it and to this tenant.
		const organizationId = (body.organizationId ?? (body as { organization?: { id?: ID } }).organization?.id) as ID | undefined;
		if (!organizationId) {
			throw new BadRequestException({ message: 'An organization is required', code: LINEAR_NOT_CONNECTED });
		}
		const state = await this.oauthState.create({ tenantId, organizationId, userId });
		const params = new URLSearchParams({
			client_id: this.config.clientId as string,
			redirect_uri: this.config.redirectUrl as string,
			response_type: 'code',
			scope: LINEAR_OAUTH_SCOPES.join(','),
			state,
			prompt: 'consent'
		});
		return { state, authorizeUrl: `${LINEAR_OAUTH_AUTHORIZE_URL}?${params.toString()}` };
	}

	@ApiOperation({ summary: 'A Linear connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId')
	async connection(@Param('integrationId', UUIDValidationPipe) integrationId: ID): Promise<LinearConnectionSummary> {
		return this.tenants.summaryOf(await this.tenants.requireById(integrationId));
	}

	@ApiOperation({ summary: 'Disconnect Linear from the organization' })
	@Permissions(PermissionsEnum.INTEGRATION_DELETE)
	@Delete('/:integrationId')
	@HttpCode(HttpStatus.NO_CONTENT)
	async disconnect(@Param('integrationId', UUIDValidationPipe) integrationId: ID): Promise<void> {
		await this.tenants.disconnect(await this.tenants.requireById(integrationId));
	}

	/** Who the token is (the Linear user and workspace it opens). */
	@ApiOperation({ summary: 'The Linear workspace of a connection' })
	@Get('/:integrationId/metadata')
	async metadata(@Param('integrationId', UUIDValidationPipe) integrationId: ID) {
		const tenant = await this.tenants.requireById(integrationId);
		const viewer = await (await this.tenants.clientReady(tenant)).viewer();
		return { viewer: { id: viewer.id, name: viewer.name, email: viewer.email }, organization: viewer.organization };
	}

	@ApiOperation({ summary: 'The Linear teams the connection may see' })
	@Get('/:integrationId/teams')
	async teams(@Param('integrationId', UUIDValidationPipe) integrationId: ID) {
		const tenant = await this.tenants.requireById(integrationId);
		return (await this.tenants.clientReady(tenant)).teams();
	}

	@ApiOperation({ summary: 'A Linear team with its workflow states and labels' })
	@Get('/:integrationId/teams/:teamId')
	async team(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Param('teamId') teamId: string) {
		const tenant = await this.tenants.requireById(integrationId);
		const team = await (await this.tenants.clientReady(tenant)).team(String(teamId).slice(0, 64));
		if (!team) throw new BadRequestException({ message: 'The Linear team was not found' });
		return team;
	}

	@ApiOperation({ summary: 'The team ↔ project mappings of a connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId/mappings')
	async listMappings(@Param('integrationId', UUIDValidationPipe) integrationId: ID): Promise<LinearMappingView[]> {
		const tenant = await this.tenants.requireById(integrationId);
		return (await this.mappings.list(tenant)).map(mappingView);
	}

	@ApiOperation({ summary: 'Map a Linear team to a project' })
	@Post('/:integrationId/mappings')
	@UseValidationPipe({ whitelist: true })
	async createMapping(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Body() body: CreateLinearMappingDTO): Promise<LinearMappingView> {
		const tenant = await this.tenants.requireById(integrationId);
		return mappingView(await this.mappings.createMapping(tenant, body));
	}

	@ApiOperation({ summary: 'Change a mapping' })
	@Put('/:integrationId/mappings/:mappingId')
	@UseValidationPipe({ whitelist: true })
	async updateMapping(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID,
		@Param('mappingId', UUIDValidationPipe) mappingId: ID,
		@Body() body: UpdateLinearMappingDTO
	): Promise<LinearMappingView> {
		const tenant = await this.tenants.requireById(integrationId);
		return mappingView(await this.mappings.updateMapping(tenant, mappingId, body));
	}

	@ApiOperation({ summary: 'Remove a mapping (its tasks stay)' })
	@Delete('/:integrationId/mappings/:mappingId')
	@HttpCode(HttpStatus.NO_CONTENT)
	async removeMapping(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Param('mappingId', UUIDValidationPipe) mappingId: ID): Promise<void> {
		const tenant = await this.tenants.requireById(integrationId);
		await this.mappings.removeMapping(tenant, mappingId);
	}

	/**
	 * Starts an import of the mapping's issues: the mapping is claimed first (one run at a time, 409 while one is
	 * live), the run is answered at once, and the import goes on behind the response.
	 */
	@ApiOperation({ summary: 'Import the issues of a mapped team now' })
	@Post('/:integrationId/mappings/:mappingId/import')
	@HttpCode(HttpStatus.ACCEPTED)
	@UseValidationPipe({ whitelist: true })
	async importNow(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID,
		@Param('mappingId', UUIDValidationPipe) mappingId: ID,
		@Body() body: LinearImportDTO
	): Promise<{ accepted: true; run: LinearSyncRun }> {
		const tenant = await this.tenants.requireById(integrationId);
		const mapping = await this.mappings.requireOne(tenant, mappingId);
		const requestedByUserId = RequestContext.currentUserId() as ID;
		const full = !!body.full;
		const run = await this.runs.claimImport(tenant, mapping, { full, requestedByUserId });
		// The import outlives the response: it opens a request context of its own (see `runInLinearContext`).
		setImmediate(() => {
			this.sync.importMapping(tenant, mapping, run, { full }).catch((error: unknown) => {
				this.logger.warn(`Import of mapping ${mapping.id} failed to start: ${error instanceof Error ? error.message : String(error)}`);
			});
		});
		return { accepted: true, run };
	}

	/** The latest runs, each with how many conflicts it found (the sync log). */
	@ApiOperation({ summary: 'The latest runs of a connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId/runs')
	@UseValidationPipe({ whitelist: true, transform: true })
	async listRuns(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Query() query: LinearRunsQueryDTO): Promise<Array<LinearSyncRun & { conflictCount: number }>> {
		const tenant = await this.tenants.requireById(integrationId);
		const runs = await this.runs.list(tenant, query.take ?? 50);
		const counts = await this.conflicts.countByRun(tenant, runs.map((run) => run.id as ID));
		return runs.map((run) => Object.assign(run, { conflictCount: counts.get(String(run.id)) ?? 0 }));
	}

	/**
	 * The fields changed both in Linear and on the platform to different values: Linear's value was applied, the
	 * task's is kept in the record. Open ones by default.
	 */
	@ApiOperation({ summary: 'The sync conflicts of a connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId/conflicts')
	@UseValidationPipe({ whitelist: true, transform: true })
	async listConflicts(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Query() query: LinearConflictsQueryDTO): Promise<LinearSyncConflict[]> {
		const tenant = await this.tenants.requireById(integrationId);
		return this.conflicts.list(tenant, query);
	}

	/**
	 * Resolves a conflict: `keep: external` leaves Linear's value; `keep: platform` writes the task's value back
	 * (and a mapping that sends changes out sends it to the issue). 409 when the task changed since.
	 */
	@ApiOperation({ summary: 'Resolve a sync conflict' })
	@Post('/:integrationId/conflicts/:conflictId/resolve')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true })
	async resolveConflict(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID,
		@Param('conflictId', UUIDValidationPipe) conflictId: ID,
		@Body() body: ResolveLinearConflictDTO
	): Promise<LinearSyncConflict> {
		const tenant = await this.tenants.requireById(integrationId);
		return this.conflicts.resolve(tenant, conflictId, body.keep, (RequestContext.currentUserId() as ID) ?? null);
	}
}
