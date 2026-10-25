import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import {
	IActivepiecesConnectionsListResponse,
	IActivepiecesListResponse,
	IActivepiecesMcpServer,
	IActivepiecesMcpServersListResponse,
	IActivepiecesPlatformStatus,
	IActivepiecesProject
} from '@gauzy/contracts';
import {
	ACTIVEPIECES_BASE_URL,
	ACTIVEPIECES_CONNECTIONS_URL,
	ACTIVEPIECES_MCP_SERVERS_URL,
	ACTIVEPIECES_PROJECTS_URL
} from './activepieces.config';
import { ActivepiecesCredentialsService, IActivepiecesOperatorSettings } from './activepieces-credentials.service';
import { isActivepiecesApiKey, MCP_NEEDS_USER_TOKEN, projectMcpServerUrl } from './activepieces-mcp.service';
import {
	ActivepiecesPlatformProjectQueryDto,
	LinkActivepiecesTenantProjectDto,
	ListActivepiecesPlatformProjectsQueryDto
} from './dto';

/** The `code` of the refusal to give a project that already belongs to another tenant (or another external id). */
export const ACTIVEPIECES_PROJECT_ALREADY_LINKED = 'ACTIVEPIECES_PROJECT_ALREADY_LINKED';

/** The `code` of the refusal to give a tenant a project when another project already holds its external id. */
export const ACTIVEPIECES_TENANT_ALREADY_LINKED = 'ACTIVEPIECES_TENANT_ALREADY_LINKED';

/** What the operator's provisioning or linking of a tenant's project answers. */
export interface IActivepiecesTenantProjectLink {
	tenantId: string;
	externalId: string;
	projectId: string;
	/** Whether an existing project was given to the tenant (rather than found or created). */
	linked: boolean;
}

/**
 * The platform-wide ("global") Activepieces integration: what the operator of the installation does under the
 * installation's platform key, unconfined. Reached only through `ActivepiecesPlatformController`, behind
 * `ActivepiecesOperatorGuard`; never a fallback of a tenant request.
 */
@Injectable()
export class ActivepiecesPlatformService {
	private readonly logger = new Logger(ActivepiecesPlatformService.name);
	private readonly linking = new Map<string, Promise<void>>();

	constructor(private readonly credentials: ActivepiecesCredentialsService) {}

	/**
	 * What the operator configured. Booleans and the prefix only: never a key.
	 */
	status(): IActivepiecesPlatformStatus {
		const settings = this.credentials.operatorSettings();
		return {
			platformKeyConfigured: !!settings.platformApiKey,
			projectTokensConfigured: this.credentials.isProjectTokenAvailable(settings),
			tenantProjectsEnabled: settings.tenantProjectsEnabled,
			projectExternalIdPrefix: settings.externalIdPrefix,
			baseUrl: ACTIVEPIECES_BASE_URL
		};
	}

	/**
	 * The projects of the operator's platform (the tenants' among them).
	 */
	async listProjects(
		query: ListActivepiecesPlatformProjectsQueryDto
	): Promise<IActivepiecesListResponse<IActivepiecesProject>> {
		const settings = this.credentials.operatorSettings();
		return this.credentials.requestActivepieces<IActivepiecesListResponse<IActivepiecesProject>>(
			'get',
			ACTIVEPIECES_PROJECTS_URL,
			this.platformKey(settings),
			'list the projects of the platform',
			{ params: compact({ ...query }) }
		);
	}

	/**
	 * Gives a tenant its Activepieces project: an existing project of the platform when one is named (it takes the
	 * tenant's external id), otherwise the one holding the tenant's external id, created when there is none.
	 *
	 * A project already holding the tenant's external id, or holding another external id (another tenant's, perhaps),
	 * is never taken over: the operator clears it in Activepieces first.
	 *
	 * Other API servers find the new project within ten minutes (platform-project mode) or six hours (project-token
	 * mode), or at their restart.
	 *
	 * @param tenantId - The tenant.
	 * @param input.projectId - The existing project to give it, if any.
	 */
	async connectTenantProject(
		tenantId: string,
		input: LinkActivepiecesTenantProjectDto
	): Promise<IActivepiecesTenantProjectLink> {
		const settings = this.credentials.operatorSettings();
		const platformApiKey = this.platformKey(settings);
		const externalId = this.credentials.tenantExternalId(tenantId, settings);
		const projectId = input?.projectId;

		if (!projectId) {
			this.credentials.forgetTenant(tenantId);
			const found = await this.credentials.tenantProject(tenantId, settings);
			return { tenantId, externalId, projectId: found, linked: false };
		}

		// One link of a project at a time on this server: a second request for the same project reads it after the first
		// one wrote, and sees the project taken
		return this.oneAtATime(projectId, () => this.linkProject(tenantId, externalId, projectId, platformApiKey));
	}

	/**
	 * Gives an existing project the tenant's external id, after checking it holds no other one, and checks afterwards
	 * that the external id Activepieces kept is this tenant's.
	 *
	 * Activepieces has no conditional update: two operator requests on two API servers can both read the project
	 * unassigned and both write. The re-read after the write tells which write Activepieces kept: the request whose
	 * external id is not the one kept is answered `409 ACTIVEPIECES_PROJECT_ALREADY_LINKED` and links nothing; the
	 * other tenant's external id, which won, stays as it is.
	 */
	private async linkProject(
		tenantId: string,
		externalId: string,
		projectId: string,
		platformApiKey: string
	): Promise<IActivepiecesTenantProjectLink> {
		const holder = await this.credentials.findProjectByExternalId(externalId, platformApiKey);
		if (holder?.id === projectId) {
			return { tenantId, externalId, projectId, linked: true };
		}
		if (holder) {
			throw new ConflictException({
				message: `Project ${holder.id} already holds the external id ${externalId}: clear it in Activepieces first.`,
				code: ACTIVEPIECES_TENANT_ALREADY_LINKED
			});
		}

		const projectUrl = `${ACTIVEPIECES_PROJECTS_URL}/${encodeURIComponent(projectId)}`;
		const readProject = () =>
			this.credentials.requestActivepieces<IActivepiecesProject>('get', projectUrl, platformApiKey, 'read the project');

		const target = await readProject();
		if (target?.externalId && target.externalId !== externalId) {
			throw new ConflictException({
				message: `Project ${projectId} already has the external id ${target.externalId}: clear it in Activepieces first.`,
				code: ACTIVEPIECES_PROJECT_ALREADY_LINKED
			});
		}

		await this.credentials.requestActivepieces<IActivepiecesProject>(
			'post',
			projectUrl,
			platformApiKey,
			'give the project to the tenant',
			{ data: { externalId } }
		);

		const kept = await readProject();
		if (kept?.externalId !== externalId) {
			this.logger.warn(
				`Activepieces project ${projectId} was given to another tenant (${kept?.externalId}) at the same time as to tenant ${tenantId}: not linked`
			);
			throw new ConflictException({
				message: `Project ${projectId} was given to another tenant at the same time (${kept?.externalId}).`,
				code: ACTIVEPIECES_PROJECT_ALREADY_LINKED
			});
		}

		this.credentials.forgetTenant(tenantId);
		this.logger.log(`Activepieces project ${projectId} given to tenant ${tenantId}`);
		return { tenantId, externalId, projectId, linked: true };
	}

	/** Runs the tasks of one key one after the other, on this server. */
	private async oneAtATime<T>(key: string, task: () => Promise<T>): Promise<T> {
		const previous = this.linking.get(key) ?? Promise.resolve();
		const run = previous.then(task, task);
		const tail = run.then(
			() => undefined,
			() => undefined
		);
		this.linking.set(key, tail);
		try {
			return await run;
		} finally {
			if (this.linking.get(key) === tail) {
				this.linking.delete(key);
			}
		}
	}

	/**
	 * The connections of any project of the platform.
	 */
	async listConnections(query: ActivepiecesPlatformProjectQueryDto): Promise<IActivepiecesConnectionsListResponse> {
		const settings = this.credentials.operatorSettings();
		return this.credentials.requestActivepieces<IActivepiecesConnectionsListResponse>(
			'get',
			ACTIVEPIECES_CONNECTIONS_URL,
			this.platformKey(settings),
			'list the connections of the project',
			{ params: compact({ ...query }) }
		);
	}

	/**
	 * The MCP servers of any project of the platform (the controller strips their tokens): under Activepieces MCP 2.0
	 * (the default) the project's one server, `GET /v1/projects/:projectId/mcp-server`; with
	 * `GAUZY_ACTIVEPIECES_MCP_API=legacy`, the `GET /v1/mcp-servers` list it replaced.
	 *
	 * Both accept only user tokens: an installation key that is an Activepieces API key (`sk-…`) is refused here with
	 * 400 and an explanation, before anything is sent, rather than sent for Activepieces to refuse.
	 */
	async listMcpServers(query: ActivepiecesPlatformProjectQueryDto): Promise<IActivepiecesMcpServersListResponse> {
		const settings = this.credentials.operatorSettings();
		const key = this.platformKey(settings);
		if (isActivepiecesApiKey(key)) {
			throw new BadRequestException(
				`${MCP_NEEDS_USER_TOKEN} The installation's key (GAUZY_ACTIVEPIECES_API_KEY) is an API key: read a project's MCP server as its tenant, in the project_token connection mode.`
			);
		}
		if (settings.mcpApi === 'legacy') {
			return this.credentials.requestActivepieces<IActivepiecesMcpServersListResponse>(
				'get',
				ACTIVEPIECES_MCP_SERVERS_URL,
				key,
				'list the MCP servers of the project',
				{ params: compact({ ...query }) }
			);
		}
		const server = await this.credentials.requestActivepieces<IActivepiecesMcpServer>(
			'get',
			projectMcpServerUrl(query.projectId),
			key,
			'read the MCP server of the project'
		);
		return {
			data: server ? [{ ...server, projectId: server.projectId ?? query.projectId }] : [],
			next: null,
			previous: null
		};
	}

	private platformKey(settings: IActivepiecesOperatorSettings): string {
		if (!settings.platformApiKey) {
			throw new BadRequestException('GAUZY_ACTIVEPIECES_API_KEY is not configured on this installation.');
		}
		return settings.platformApiKey;
	}
}

function compact(values: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== '')
	);
}
