import { BadGatewayException, BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Logger, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, RequestContext, TenantPermissionGuard, UUIDValidationPipe, UseValidationPipe } from '@gauzy/core';
import { TrelloApiClient, TrelloApiError } from './client/trello-api.client';
import { CreateTrelloMappingDTO, TrelloConnectDTO, TrelloImportDTO, TrelloInstallStateDTO, TrelloRunsQueryDTO, TrelloConflictsQueryDTO, ResolveTrelloConflictDTO, TrelloStatusQueryDTO, UpdateTrelloMappingDTO } from './dto/trello.dto';
import { TrelloSyncConflict } from './entities/trello-sync-conflict.entity';
import { TrelloSyncRun } from './entities/trello-sync-run.entity';
import { TrelloBoardMapping, TrelloSyncDirection } from './entities/trello-board-mapping.entity';
import { isTrelloConfigured, TrelloConfig, trelloWebhooksEnabled } from './trello-config';
import { TrelloConnectStateService } from './trello-connect-state.service';
import { TrelloMappingService } from './trello-mapping.service';
import { TrelloSyncConflictService } from './trello-sync-conflict.service';
import { TrelloSyncRunService } from './trello-sync-run.service';
import { TrelloConnectionSummary, TrelloTenantService } from './trello-tenant.service';
import {
	TRELLO_AUTHORIZE_URL,
	TRELLO_CONFIG,
	TRELLO_MAPPING_NOT_INBOUND,
	TRELLO_NOT_CONFIGURED,
	TRELLO_NOT_CONNECTED,
	TRELLO_ROUTE_PREFIX,
	TRELLO_STATE_INVALID,
	TRELLO_TOKEN_REFUSED,
	TRELLO_REQUEST_REFUSED,
	TRELLO_UNAVAILABLE,
	TRELLO_WEBHOOK_NOT_REMOVED
} from './trello.constants';
import { TrelloSyncService } from './sync/trello-sync.service';
import { parseListMap } from './sync/trello-card.mapper';

/** What a mapping route answers: the row with its list map resolved. */
export interface TrelloMappingView extends Omit<TrelloBoardMapping, 'listMap'> {
	listMap: Record<string, string>;
	hasWebhook: boolean;
}

function mappingView(mapping: TrelloBoardMapping): TrelloMappingView {
	return { ...mapping, listMap: parseListMap(mapping.listMap), hasWebhook: !!mapping.webhookId } as TrelloMappingView;
}

/**
 * The management routes of the Trello integration (`/integration/trello`): connect (the state of the authorize
 * flow, then the token the person brings back), the connection's status, the boards and a board's lists, the
 * board ↔ project mappings, imports and runs. Every route is tenant-scoped by the platform's guards.
 */
@ApiTags('Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller(TRELLO_ROUTE_PREFIX)
export class TrelloController {
	private readonly logger = new Logger(TrelloController.name);

	constructor(
		@Inject(TRELLO_CONFIG) private readonly config: TrelloConfig,
		private readonly tenants: TrelloTenantService,
		private readonly mappings: TrelloMappingService,
		private readonly runs: TrelloSyncRunService,
		private readonly sync: TrelloSyncService,
		private readonly conflicts: TrelloSyncConflictService,
		private readonly connectState: TrelloConnectStateService
	) {}

	/**
	 * A read of Trello for a route: Trello's own refusals are answered as such — a refused token is recorded on the
	 * connection (the page then asks for a reconnect) and answered 400 `TRELLO_TOKEN_REFUSED`; anything else Trello
	 * answered (a rate limit, an outage) is 502 `TRELLO_UNAVAILABLE`, not a 500 that says nothing.
	 */
	private async trello<T>(tenant: Parameters<TrelloTenantService['clientFor']>[0], make: (client: TrelloApiClient) => Promise<T>): Promise<T> {
		try {
			return await make(this.tenants.clientFor(tenant));
		} catch (error) {
			if (error instanceof TrelloApiError) {
				if (error.isUnauthorized) {
					await this.tenants.setAttention(tenant, 'token_refused');
					throw new BadRequestException({ message: 'Trello refused the connection\'s token; connect again', code: TRELLO_TOKEN_REFUSED });
				}
				// The user lacks access to that one resource, or it is gone: the request's refusal, not the connection's.
				if (error.isForbidden || error.isNotFound) {
					throw new BadRequestException({ message: `Trello refused the request: ${error.message}`, code: TRELLO_REQUEST_REFUSED });
				}
				throw new BadGatewayException({ message: `Trello did not answer: ${error.message}`, code: TRELLO_UNAVAILABLE });
			}
			throw error;
		}
	}

	/** Whether the application is configured and webhooks can be taken, and the organization's connection if any. */
	@ApiOperation({ summary: 'The Trello integration status of an organization' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/status')
	@UseValidationPipe({ whitelist: true, transform: true })
	async status(@Query() query: TrelloStatusQueryDTO): Promise<{ configured: boolean; webhooks: boolean; connection: TrelloConnectionSummary | null }> {
		const tenant = await this.tenants.forOrganization(query.organizationId as ID);
		return { configured: isTrelloConfigured(this.config), webhooks: trelloWebhooksEnabled(this.config), connection: tenant ? this.tenants.summaryOf(tenant) : null };
	}

	/**
	 * Starts the connect flow: a single-use state bound to the caller's tenant and organization, and Trello's
	 * authorize page to send them to. Trello returns them to the configured page with the token in the URL
	 * fragment (`#token=`) and the state in the query; the page then posts both to `/connect`.
	 */
	@ApiOperation({ summary: 'Start the Trello connect flow' })
	@Post('/install/state')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true, transform: true })
	async installState(@Body() body: TrelloInstallStateDTO): Promise<{ state: string; authorizeUrl: string }> {
		if (!isTrelloConfigured(this.config)) {
			throw new BadRequestException({ message: 'The Trello application is not configured on this server', code: TRELLO_NOT_CONFIGURED });
		}
		const tenantId = RequestContext.currentTenantId() as ID;
		const userId = RequestContext.currentUserId() as ID;
		const organizationId = this.organizationIdOf(body);
		const state = await this.connectState.create({ tenantId, organizationId, userId });
		const returnUrl = new URL(this.config.returnUrl as string);
		// A hash-routed page keeps its query inside the fragment; a path-routed one in the search part.
		if (returnUrl.hash) {
			returnUrl.hash = `${returnUrl.hash}${returnUrl.hash.includes('?') ? '&' : '?'}state=${encodeURIComponent(state)}`;
		} else {
			returnUrl.searchParams.set('state', state);
		}
		const params = new URLSearchParams({
			expiration: 'never',
			name: this.config.appName,
			scope: 'read,write',
			response_type: 'token',
			key: this.config.apiKey as string,
			return_url: returnUrl.toString(),
			callback_method: 'fragment'
		});
		return { state, authorizeUrl: `${TRELLO_AUTHORIZE_URL}?${params.toString()}` };
	}

	/**
	 * Finishes the connect flow with the token the person brought back: the state must be the one minted for this
	 * organization, and Trello must know the token (it names the member); the connection is then written.
	 */
	@ApiOperation({ summary: 'Finish the Trello connect flow with the token' })
	@Post('/connect')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true, transform: true })
	async connect(@Body() body: TrelloConnectDTO): Promise<TrelloConnectionSummary> {
		if (!isTrelloConfigured(this.config)) {
			throw new BadRequestException({ message: 'The Trello application is not configured on this server', code: TRELLO_NOT_CONFIGURED });
		}
		const tenantId = RequestContext.currentTenantId() as ID;
		const userId = RequestContext.currentUserId() as ID;
		const organizationId = this.organizationIdOf(body);
		const scope = await this.connectState.consume(body.state);
		if (!scope || String(scope.tenantId) !== String(tenantId) || String(scope.organizationId) !== String(organizationId)) {
			throw new BadRequestException({ message: 'The connect flow expired, was already used, or belongs to another organization', code: TRELLO_STATE_INVALID });
		}
		let member;
		try {
			member = await this.tenants.clientForToken(body.token).me();
		} catch (error) {
			if (error instanceof TrelloApiError && error.isUnauthorized) {
				throw new BadRequestException({ message: 'Trello does not know this token', code: TRELLO_TOKEN_REFUSED });
			}
			throw error;
		}
		const tenant = await this.tenants.connect({ tenantId, organizationId, userId }, body.token, member);
		return this.tenants.summaryOf(tenant);
	}

	@ApiOperation({ summary: 'A Trello connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId')
	async connection(@Param('integrationId', UUIDValidationPipe) integrationId: ID): Promise<TrelloConnectionSummary> {
		return this.tenants.summaryOf(await this.tenants.requireById(integrationId));
	}

	@ApiOperation({ summary: 'Disconnect Trello from the organization' })
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

	/** Who the token is, and the open boards it may see. */
	@ApiOperation({ summary: 'The Trello member and boards of a connection' })
	@Get('/:integrationId/metadata')
	async metadata(@Param('integrationId', UUIDValidationPipe) integrationId: ID) {
		const tenant = await this.tenants.requireById(integrationId);
		const [me, boards] = await this.trello(tenant, (client) => Promise.all([client.me(), client.boards()]));
		return { member: { id: me.id, username: me.username, fullName: me.fullName }, boards };
	}

	@ApiOperation({ summary: 'The lists of a Trello board' })
	@Get('/:integrationId/boards/:boardId/lists')
	async lists(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Param('boardId') boardId: string) {
		const tenant = await this.tenants.requireById(integrationId);
		return this.trello(tenant, (client) => client.lists(String(boardId).slice(0, 32)));
	}

	@ApiOperation({ summary: 'The board ↔ project mappings of a connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId/mappings')
	async listMappings(@Param('integrationId', UUIDValidationPipe) integrationId: ID): Promise<TrelloMappingView[]> {
		const tenant = await this.tenants.requireById(integrationId);
		return (await this.mappings.list(tenant)).map(mappingView);
	}

	/** Maps a board to a project; the webhook is registered behind the answer (best effort). */
	@ApiOperation({ summary: 'Map a Trello board to a project' })
	@Post('/:integrationId/mappings')
	@UseValidationPipe({ whitelist: true })
	async createMapping(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Body() body: CreateTrelloMappingDTO): Promise<TrelloMappingView> {
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
		@Body() body: UpdateTrelloMappingDTO
	): Promise<TrelloMappingView> {
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

	/** Registers the mapping's webhook again (after a failed registration, or once the public address and the secret are set). */
	@ApiOperation({ summary: 'Register the webhook of a mapping again' })
	@Post('/:integrationId/mappings/:mappingId/webhook')
	@HttpCode(HttpStatus.ACCEPTED)
	async registerWebhook(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Param('mappingId', UUIDValidationPipe) mappingId: ID): Promise<{ accepted: true }> {
		if (!trelloWebhooksEnabled(this.config)) {
			throw new BadRequestException({ message: 'This server has no public address or application secret for Trello webhooks', code: TRELLO_NOT_CONFIGURED });
		}
		const tenant = await this.tenants.requireById(integrationId);
		const mapping = await this.mappings.requireOne(tenant, mappingId);
		// The current webhook must be gone before it is forgotten: one Trello still delivers to is not left untracked.
		if (!(await this.sync.removeWebhook(tenant, mapping))) {
			throw new BadGatewayException({ message: 'The current Trello webhook could not be removed; try again', code: TRELLO_WEBHOOK_NOT_REMOVED });
		}
		await this.mappings.recordWebhook(mapping, null);
		setImmediate(() => void this.sync.ensureWebhook(tenant, mapping));
		return { accepted: true };
	}

	/** Starts an import of the mapping's cards: the mapping is claimed first (409 while one is live), the run answered at once. */
	@ApiOperation({ summary: 'Import the cards of a mapped Trello board now' })
	@Post('/:integrationId/mappings/:mappingId/import')
	@HttpCode(HttpStatus.ACCEPTED)
	@UseValidationPipe({ whitelist: true })
	async importNow(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID,
		@Param('mappingId', UUIDValidationPipe) mappingId: ID,
		@Body() body: TrelloImportDTO
	): Promise<{ accepted: true; run: TrelloSyncRun }> {
		const tenant = await this.tenants.requireById(integrationId);
		const mapping = await this.mappings.requireOne(tenant, mappingId);
		// The same rule as the webhook path: an outbound or switched-off mapping brings nothing in.
		if (mapping.direction === TrelloSyncDirection.OUTBOUND || !mapping.syncEnabled) {
			throw new BadRequestException({ message: 'This mapping does not import cards (it is outbound, or its sync is off)', code: TRELLO_MAPPING_NOT_INBOUND });
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
	async listRuns(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Query() query: TrelloRunsQueryDTO): Promise<Array<TrelloSyncRun & { conflictCount: number }>> {
		const tenant = await this.tenants.requireById(integrationId);
		const runs = await this.runs.list(tenant, query.take ?? 50);
		// Each run with how many conflicts it found (the sync log).
		const counts = await this.conflicts.countByRun(tenant, runs.map((run) => run.id as ID));
		return runs.map((run) => Object.assign(run, { conflictCount: counts.get(String(run.id)) ?? 0 }));
	}

	/**
	 * The fields changed both in Trello and on the platform to different values: Trello's value was applied, the
	 * task's is kept in the record. Open ones by default.
	 */
	@ApiOperation({ summary: 'The sync conflicts of a connection' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	@Get('/:integrationId/conflicts')
	@UseValidationPipe({ whitelist: true, transform: true })
	async listConflicts(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Query() query: TrelloConflictsQueryDTO): Promise<TrelloSyncConflict[]> {
		const tenant = await this.tenants.requireById(integrationId);
		return this.conflicts.list(tenant, query);
	}

	/**
	 * Resolves a conflict: `keep: external` leaves Trello's value; `keep: platform` writes the task's value back
	 * (and a mapping that sends changes out sends it to the card). 409 when the task changed since.
	 */
	@ApiOperation({ summary: 'Resolve a sync conflict' })
	@Post('/:integrationId/conflicts/:conflictId/resolve')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true })
	async resolveConflict(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID,
		@Param('conflictId', UUIDValidationPipe) conflictId: ID,
		@Body() body: ResolveTrelloConflictDTO
	): Promise<TrelloSyncConflict> {
		const tenant = await this.tenants.requireById(integrationId);
		return this.conflicts.resolve(tenant, conflictId, body.keep, (RequestContext.currentUserId() as ID) ?? null);
	}

	private organizationIdOf(body: { organizationId?: ID; organization?: { id?: ID } }): ID {
		const organizationId = (body.organizationId ?? body.organization?.id) as ID | undefined;
		if (!organizationId) {
			throw new BadRequestException({ message: 'An organization is required', code: TRELLO_NOT_CONNECTED });
		}
		return organizationId;
	}
}
