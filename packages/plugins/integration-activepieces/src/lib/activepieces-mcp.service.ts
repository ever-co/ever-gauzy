import {
	Injectable,
	BadGatewayException,
	BadRequestException,
	Logger,
	HttpException,
	HttpStatus,
	NotFoundException
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@gauzy/config';
import { firstValueFrom, catchError } from 'rxjs';
import { AxiosError } from 'axios';
import { IntegrationTenantService, RequestContext } from '@gauzy/core';
import {
	ActivepiecesConnectionMode,
	IActivepiecesMcpServer,
	IActivepiecesMcpServersListResponse,
	IActivepiecesMcpServersListParams
} from '@gauzy/contracts';
import { ActivepiecesMcpCreateDto, ActivepiecesMcpUpdateDto } from './dto';
import {
	ACTIVEPIECES_MCP_SERVERS_URL,
	ACTIVEPIECES_PROJECT_MCP_SERVER_PATH,
	ACTIVEPIECES_PROJECTS_URL
} from './activepieces.config';
import {
	ActivepiecesCredentialsService,
	ActivepiecesMcpApi,
	IActivepiecesCredential
} from './activepieces-credentials.service';

/**
 * The query of an MCP server list. `projectId` is optional: in the modes that pin the tenant's own project, the server
 * names it; with the tenant's own key, the client must.
 */
export type ActivepiecesMcpServersListInput = Omit<IActivepiecesMcpServersListParams, 'projectId'> & {
	projectId?: string;
};

/** The first words of every refusal of a credential Activepieces does not accept on its MCP routes. */
export const MCP_NEEDS_USER_TOKEN =
	'Activepieces accepts only a user token on its MCP routes, never an API key, so MCP is not available here.';

/** The first words of the refusal to create or delete a server under MCP 2.0. */
export const MCP_ONE_SERVER_PER_PROJECT = 'An Activepieces MCP 2.0 project has exactly one MCP server.';

/**
 * The Activepieces URL of one MCP server of the legacy API (`GAUZY_ACTIVEPIECES_MCP_API=legacy`). The id is the
 * caller's, from the route, and Express decodes `%2F` in a route parameter: unencoded, `..%2F..%2F<path>` turned the
 * update and the token rotation into POSTs to any other path of the Activepieces API, under the installation's key
 * when the tenant has none of its own. `encodeURIComponent` leaves dots alone, so `.` and `..` (`%2E%2E` in the route)
 * are refused: the HTTP client resolves them as path segments, to the server list or to the API's root.
 *
 * @param serverId - The MCP server id.
 * @throws BadRequestException for an empty id, or one that is only dots.
 */
export function mcpServerUrl(serverId: string): string {
	if (!serverId?.trim()) {
		throw new BadRequestException('serverId is required');
	}
	if (serverId === '.' || serverId === '..') {
		throw new BadRequestException('serverId is not a valid MCP server id');
	}
	return `${ACTIVEPIECES_MCP_SERVERS_URL}/${encodeURIComponent(serverId)}`;
}

/**
 * The Activepieces URL of a project's one MCP server (MCP 2.0): `/v1/projects/:projectId/mcp-server`. The project is
 * the tenant's own in the modes that pin one, else the client's: it is encoded, and `.` / `..` are refused, for the
 * reason {@link mcpServerUrl} gives.
 *
 * @param projectId - The project.
 * @throws BadRequestException for an empty id, or one that is only dots.
 */
export function projectMcpServerUrl(projectId: string): string {
	const id = typeof projectId === 'string' ? projectId.trim() : '';
	if (!id) {
		throw new BadRequestException('projectId is required');
	}
	if (id === '.' || id === '..') {
		throw new BadRequestException('projectId is not a valid Activepieces project id');
	}
	return `${ACTIVEPIECES_PROJECTS_URL}/${encodeURIComponent(id)}/${ACTIVEPIECES_PROJECT_MCP_SERVER_PATH}`;
}

/**
 * Whether a bearer token is an Activepieces API key: Activepieces issues them as `sk-<random>`
 * (`api-key-service.ts`), and authenticates them as a `SERVICE` principal, which none of its MCP routes accepts. A
 * user token (a project token, or a user's own) is a JWT.
 *
 * @param token - The bearer token.
 */
export function isActivepiecesApiKey(token: string | null | undefined): boolean {
	return typeof token === 'string' && token.trim().startsWith('sk-');
}

/**
 * The tenant's Activepieces MCP server.
 *
 * Activepieces replaced its MCP API in November 2025 ("MCP 2.0"): instead of named servers listed and read by id at
 * `/v1/mcp-servers`, every project has exactly one MCP server, at `/v1/projects/:projectId/mcp-server` (`GET` reads
 * it, `POST` updates its `disabledTools`, `POST …/rotate` rotates its token). Those routes are the default here; the
 * old ones stay behind `GAUZY_ACTIVEPIECES_MCP_API=legacy`, for a self-hosted Activepieces older than that.
 *
 * Both APIs accept only user tokens (`PrincipalType.USER`), never an API key. So MCP works in the `project_token`
 * mode — a user token of the tenant's own project — and with a tenant's own key only when that key is a user token.
 * In the `platform_project` mode (the installation's API key) and with a tenant's own API key, every MCP call is
 * refused here with 400 and an explanation, before anything is sent; Activepieces' own refusal of a credential is
 * answered 502, never passed on as a 401/403 of this API.
 *
 * The routes the controller keeps still name a server: `GET|PATCH|DELETE /:serverId` and `POST /:serverId/rotate`. Under
 * MCP 2.0 the server is the project's one: it is read first, and answered as missing (404) unless its id is the one
 * named and, in the modes that pin the tenant's own project, it is in that project.
 *
 * Creating (`POST /`) and deleting (`DELETE /:serverId`) a server are legacy routes only: under MCP 2.0 a project's one
 * server comes and goes with the project, so both are refused there (400, nothing sent).
 */
@Injectable()
export class ActivepiecesMcpService {
	private readonly logger = new Logger(ActivepiecesMcpService.name);

	constructor(
		private readonly httpService: HttpService,
		private readonly configService: ConfigService,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly credentials: ActivepiecesCredentialsService
	) {}

	/** The MCP routes to call (`GAUZY_ACTIVEPIECES_MCP_API`): MCP 2.0 unless the operator chose `legacy`. */
	mcpApi(): ActivepiecesMcpApi {
		return this.credentials.mcpApi();
	}

	/**
	 * List MCP servers for a project
	 *
	 * In the modes that pin the tenant's own project, that project is listed whatever the client named (another one is
	 * refused), and only its servers are returned. Under MCP 2.0 the list is the project's one server; the legacy
	 * filters (`limit`, `cursor`, `name`) do not apply to it.
	 */
	async listMcpServers(params: ActivepiecesMcpServersListInput): Promise<IActivepiecesMcpServersListResponse> {
		try {
			const credential = await this.getMcpCredential();
			const projectId = this.credentials.projectFor(credential, params.projectId);

			if (this.mcpApi() === 'v2') {
				const server = await this.readProjectServer(projectId, credential);
				return { data: server ? [server] : [], next: null, previous: null };
			}

			// Build query parameters
			const queryParams: Record<string, unknown> = {
				projectId
			};

			if (params.limit) queryParams['limit'] = params.limit.toString();
			if (params.cursor) queryParams['cursor'] = params.cursor;
			if (params.name) queryParams['name'] = params.name;

			const result = await this.request<IActivepiecesMcpServersListResponse>(
				'get',
				ACTIVEPIECES_MCP_SERVERS_URL,
				undefined,
				queryParams,
				credential
			);

			if (credential.enforceProject) {
				return {
					...result,
					data: (result?.data ?? []).filter((server) =>
						this.credentials.isInProject(credential, server?.projectId)
					)
				};
			}
			return result;
		} catch (error: any) {
			this.logger.error('Failed to list ActivePieces MCP servers:', error);
			throw new HttpException(
				`Failed to list ActivePieces MCP servers: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Get MCP server by ID
	 *
	 * In the modes that pin the tenant's own project, a server of another project is answered as missing. Under MCP
	 * 2.0, so is any id but that of the project's one server.
	 *
	 * @param serverId - The server.
	 * @param projectId - The project, under MCP 2.0 with the tenant's own key (the pinned project otherwise).
	 */
	async getMcpServer(serverId: string, projectId?: string): Promise<IActivepiecesMcpServer> {
		try {
			if (this.mcpApi() === 'v2') {
				const credential = await this.getMcpCredential();
				return (await this.readProjectServerById(serverId, projectId, credential)).server;
			}

			const url = mcpServerUrl(serverId);
			const credential = await this.getMcpCredential();
			const server = await this.request<IActivepiecesMcpServer>('get', url, undefined, undefined, credential);
			this.credentials.assertInProject(credential, server?.projectId, 'MCP server');
			return server;
		} catch (error: any) {
			this.logger.error('Failed to get ActivePieces MCP server:', error);
			throw new HttpException(
				`Failed to get ActivePieces MCP server: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Update MCP server
	 *
	 * In the modes that pin the tenant's own project, the server is first checked to be in it. Under MCP 2.0 the
	 * project's server is read first and must be the one named; the update is its `disabledTools` (a server has no
	 * name or tool list of its own there).
	 *
	 * @param serverId - The server.
	 * @param updateData - The update.
	 * @param projectId - The project, under MCP 2.0 with the tenant's own key (the pinned project otherwise).
	 */
	async updateMcpServer(
		serverId: string,
		updateData: ActivepiecesMcpUpdateDto,
		projectId?: string
	): Promise<IActivepiecesMcpServer> {
		try {
			if (this.mcpApi() === 'v2') {
				const body = projectMcpServerUpdate(updateData);
				const credential = await this.getMcpCredential();
				const { projectId: project } = await this.readProjectServerById(serverId, projectId, credential);
				const result = await this.request<IActivepiecesMcpServer>(
					'post',
					projectMcpServerUrl(project),
					body,
					undefined,
					credential
				);
				this.logger.log(`Successfully updated the ActivePieces MCP server of project: ${project}`);
				return { ...result, projectId: result?.projectId ?? project };
			}

			const url = mcpServerUrl(serverId);
			const credential = await this.getMcpCredential();
			if (updateData?.disabledTools !== undefined) {
				throw new BadRequestException(
					'disabledTools is a setting of Activepieces MCP 2.0; this installation calls the legacy MCP routes.'
				);
			}
			await this.assertServerInProject(url, credential);

			const result = await this.request<IActivepiecesMcpServer>('post', url, updateData, undefined, credential);

			this.logger.log(`Successfully updated ActivePieces MCP server: ${result.id}`);
			return result;
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to update ActivePieces MCP server:', error);
			throw new BadRequestException(`Failed to update MCP server: ${error.message}`);
		}
	}

	/**
	 * Rotate MCP server token
	 *
	 * In the modes that pin the tenant's own project, the server is first checked to be in it. Under MCP 2.0 the
	 * project's server is read first and must be the one named.
	 *
	 * @param serverId - The server.
	 * @param projectId - The project, under MCP 2.0 with the tenant's own key (the pinned project otherwise).
	 */
	async rotateMcpServerToken(serverId: string, projectId?: string): Promise<IActivepiecesMcpServer> {
		try {
			if (this.mcpApi() === 'v2') {
				const credential = await this.getMcpCredential();
				const { projectId: project } = await this.readProjectServerById(serverId, projectId, credential);
				const result = await this.request<IActivepiecesMcpServer>(
					'post',
					`${projectMcpServerUrl(project)}/rotate`,
					{}, // No body required for rotate
					undefined,
					credential
				);
				this.logger.log(`Successfully rotated the ActivePieces MCP server token of project: ${project}`);
				return { ...result, projectId: result?.projectId ?? project };
			}

			const url = mcpServerUrl(serverId);
			const credential = await this.getMcpCredential();
			await this.assertServerInProject(url, credential);

			const result = await this.request<IActivepiecesMcpServer>(
				'post',
				`${url}/rotate`,
				{}, // No body required for rotate
				undefined,
				credential
			);

			this.logger.log(`Successfully rotated ActivePieces MCP server token: ${result.id}`);
			return result;
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to rotate ActivePieces MCP server token:', error);
			throw new BadRequestException(`Failed to rotate MCP server token: ${error.message}`);
		}
	}

	/**
	 * Create an MCP server (legacy API: `POST /v1/mcp-servers`, from a name, in a project).
	 *
	 * The project is the tenant's own in the modes that pin one (another named is refused, 403), else the one the client
	 * names; a server Activepieces answers in another project is refused as missing. Under MCP 2.0 a project has exactly
	 * one server, created with it, so the call is refused (400) before anything is sent.
	 *
	 * @param data - The server's name; an agent is refused, since Activepieces creates a server from its name alone.
	 * @param projectId - The project, with the tenant's own key (the pinned project otherwise).
	 */
	async createMcpServer(data: ActivepiecesMcpCreateDto, projectId?: string): Promise<IActivepiecesMcpServer> {
		try {
			if (this.mcpApi() === 'v2') {
				throw new BadRequestException(
					`${MCP_ONE_SERVER_PER_PROJECT} It is created with the project: read it with GET /integration/activepieces/mcp/tenant.`
				);
			}
			const name = typeof data?.name === 'string' ? data.name.trim() : '';
			if (!name) {
				throw new BadRequestException('name is required');
			}
			if (data?.agentId !== undefined) {
				throw new BadRequestException(
					'Activepieces creates an MCP server from its name alone: link the agent in Activepieces instead.'
				);
			}

			const credential = await this.getMcpCredential();
			const project = this.credentials.projectFor(credential, projectId);
			const result = await this.request<IActivepiecesMcpServer>(
				'post',
				ACTIVEPIECES_MCP_SERVERS_URL,
				{ name, projectId: project },
				undefined,
				credential
			);
			this.credentials.assertInProject(credential, result?.projectId ?? project, 'MCP server');

			this.logger.log(`Successfully created ActivePieces MCP server: ${result?.id}`);
			return { ...result, projectId: result?.projectId ?? project };
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to create ActivePieces MCP server:', error);
			throw new BadRequestException(`Failed to create MCP server: ${error.message}`);
		}
	}

	/**
	 * Delete an MCP server (legacy API: `DELETE /v1/mcp-servers/:id`).
	 *
	 * In the modes that pin the tenant's own project, the server is first checked to be in it. Under MCP 2.0 a project's
	 * one server cannot be deleted, so the call is refused (400) before anything is sent.
	 *
	 * @param serverId - The server.
	 */
	async deleteMcpServer(serverId: string): Promise<void> {
		try {
			if (this.mcpApi() === 'v2') {
				throw new BadRequestException(
					`${MCP_ONE_SERVER_PER_PROJECT} It cannot be deleted: disable its tools (PATCH /integration/activepieces/mcp/:serverId) or rotate its token instead.`
				);
			}

			const url = mcpServerUrl(serverId);
			const credential = await this.getMcpCredential();
			await this.assertServerInProject(url, credential);

			await this.request<void>('delete', url, undefined, undefined, credential);

			this.logger.log(`Successfully deleted ActivePieces MCP server: ${serverId}`);
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to delete ActivePieces MCP server:', error);
			throw new BadRequestException(`Failed to delete MCP server: ${error.message}`);
		}
	}

	/**
	 * Get MCP servers for current tenant
	 *
	 * Under MCP 2.0 that is the server of the tenant's project (its own, pinned, or the one named with the tenant's own
	 * key). The legacy servers carried names, and only those naming the tenant (or `gauzy`) are kept.
	 */
	async getTenantMcpServers(projectId?: string): Promise<IActivepiecesMcpServer[]> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			const response = await this.listMcpServers({
				projectId
			});

			if (this.mcpApi() === 'v2') {
				return response.data;
			}

			// Filter MCP servers by tenant (if they have tenant-specific naming or metadata)
			return response.data.filter(
				(server) => !!server.name && (server.name.includes(tenantId) || server.name.includes('gauzy'))
			);
		} catch (error: any) {
			this.logger.error('Failed to get tenant MCP servers:', error);
			throw new HttpException(
				`Failed to get tenant MCP servers: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Reads a project's one MCP server (MCP 2.0) and, in the modes that pin the tenant's own project, refuses one of
	 * another project (404). Activepieces answers the server of the project in the URL; a server answered without its
	 * project is read as that project's.
	 */
	private async readProjectServer(
		projectId: string,
		credential: IActivepiecesCredential
	): Promise<IActivepiecesMcpServer> {
		const server = await this.request<IActivepiecesMcpServer>(
			'get',
			projectMcpServerUrl(projectId),
			undefined,
			undefined,
			credential
		);
		const scoped = { ...server, projectId: server?.projectId ?? projectId };
		this.credentials.assertInProject(credential, scoped.projectId, 'MCP server');
		return scoped;
	}

	/**
	 * Reads the project's MCP server for a route that names a server by id (MCP 2.0): the project is the tenant's own
	 * in the modes that pin one (another named is refused, 403), else the one the client names; and the server is
	 * answered as missing (404) unless it is the one named, so nothing is changed on a server the caller did not name.
	 */
	private async readProjectServerById(
		serverId: string,
		requestedProjectId: string | undefined,
		credential: IActivepiecesCredential
	): Promise<{ server: IActivepiecesMcpServer; projectId: string }> {
		const id = typeof serverId === 'string' ? serverId.trim() : '';
		if (!id) {
			throw new BadRequestException('serverId is required');
		}
		const projectId = this.credentials.projectFor(credential, requestedProjectId);
		const server = await this.readProjectServer(projectId, credential);
		if (server?.id !== id) {
			throw new NotFoundException('MCP server not found');
		}
		return { server, projectId };
	}

	/**
	 * In the modes that pin the tenant's own project, reads the server first and refuses one of another project, before
	 * it is changed: under the installation's key, Activepieces would change it in whichever project it is in.
	 */
	private async assertServerInProject(url: string, credential: IActivepiecesCredential): Promise<void> {
		if (!credential.enforceProject) {
			return;
		}
		const server = await this.request<IActivepiecesMcpServer>('get', url, undefined, undefined, credential);
		this.credentials.assertInProject(credential, server?.projectId, 'MCP server');
	}

	/**
	 * Helper method for making HTTP requests with standard headers and error handling
	 *
	 * Activepieces' refusal of the credential (401, 403) is answered 502 with an explanation: passed on as it was, a
	 * 401 of this API reads as the caller's own session having ended.
	 */
	private async request<T>(
		method: 'get' | 'post' | 'put' | 'delete',
		url: string,
		data?: unknown,
		params?: Record<string, unknown>,
		credential?: IActivepiecesCredential
	): Promise<T> {
		const { token } = credential ?? (await this.getCredential());

		const config = {
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			...(params && { params })
		};

		return firstValueFrom(
			this.httpService
				.request<T>({
					method,
					url,
					data,
					...config,
					timeout: 8000
				})
				.pipe(
					catchError((error: AxiosError) => {
						const status = error?.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
						const message = error?.message || 'Unknown error occurred';

						this.logger.error(`Error making ${method.toUpperCase()} ${url}`, {
							status,
							message
						});
						if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
							throw new BadGatewayException(
								`Activepieces refused the MCP request (HTTP ${status}): its MCP routes accept only a user token of the project, with the MCP permission.`
							);
						}
						throw new HttpException(`HTTP ${method.toUpperCase()} request failed: ${message}`, status);
					})
				)
		).then((response) => response.data);
	}

	/**
	 * The credential of the current tenant's MCP calls (see {@link getCredential}), refused (400, before anything is
	 * sent) when Activepieces would refuse it on its MCP routes, which accept only user tokens:
	 *
	 * - `platform_project`: the installation's API key, pinned to the tenant's project — an API key;
	 * - any credential that is an API key (`sk-…`): a tenant's own key saved as an API key.
	 *
	 * A project token, and a tenant's own user token, pass.
	 *
	 * The refusal is made while the credential is resolved, as soon as the mode is decided (`beforeConnect`): in the
	 * `platform_project` mode, resolving goes on to look up (or create) the tenant's Activepieces project and to record
	 * it, which an MCP call that is refused anyway must not do. The resolved credential is checked again after.
	 *
	 * @throws BadRequestException naming what would work instead.
	 */
	private async getMcpCredential(): Promise<IActivepiecesCredential> {
		const credential = await this.getCredential((mode, ownApiKey) => this.assertMcpCapable(mode, ownApiKey));
		this.assertMcpCapable(credential.mode, credential.token);
		return credential;
	}

	/**
	 * Refuses (400) a connection mode, or a bearer token, that Activepieces does not accept on its MCP routes: the
	 * `platform_project` mode (the installation's API key), and any API key (`sk-…`).
	 *
	 * @param mode - The mode the request runs under.
	 * @param token - The bearer token, when it is known.
	 * @throws BadRequestException naming what would work instead.
	 */
	private assertMcpCapable(mode: ActivepiecesConnectionMode | null, token?: string | null): void {
		if (mode === ActivepiecesConnectionMode.PLATFORM_PROJECT) {
			const instead = this.credentials.isProjectTokenAvailable()
				? 'switch the tenant to the project_token connection mode (POST /integration/activepieces/connection-mode)'
				: 'ask the operator of this installation to enable project tokens, or connect an Activepieces user token of your own';
			throw new BadRequestException(
				`${MCP_NEEDS_USER_TOKEN} This tenant reaches Activepieces with the installation's API key (connection mode platform_project): ${instead}.`
			);
		}
		if (isActivepiecesApiKey(token)) {
			throw new BadRequestException(
				`${MCP_NEEDS_USER_TOKEN} This tenant's own Activepieces key is an API key: connect an Activepieces user token instead, or use the project_token connection mode.`
			);
		}
	}

	/**
	 * The credential of the current tenant's MCP calls: its own key (from any of its rows holding one, since connection
	 * calls used to add rows without a key), else its project token, else the installation's key pinned to the tenant's
	 * own project. It used to fall back to the installation's key unconfined, with the project and the server ids taken
	 * from the client: any tenant could list, read, change or rotate the MCP servers of any project of the platform.
	 *
	 * @param beforeConnect - Refuses a mode once it is decided, before anything is obtained for it (see
	 * `ActivepiecesCredentialsService.resolve`).
	 */
	private async getCredential(
		beforeConnect?: (mode: ActivepiecesConnectionMode | null, ownApiKey?: string) => void
	): Promise<IActivepiecesCredential> {
		try {
			return await this.credentials.resolve(beforeConnect ? { beforeConnect } : {});
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			throw new HttpException(
				`Failed to get Activepieces API key: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}

/**
 * The body of an MCP 2.0 server update (`POST /v1/projects/:projectId/mcp-server`): its `disabledTools`, the one
 * setting a project's server has there.
 *
 * @param updateData - The update the client sent.
 * @throws BadRequestException for a `name` or a `tools` list, which only the legacy servers had: dropping them would
 * answer success for a change that was never made.
 */
export function projectMcpServerUpdate(updateData: ActivepiecesMcpUpdateDto | null | undefined): {
	disabledTools?: string[];
} {
	if (updateData?.name !== undefined || updateData?.tools !== undefined) {
		throw new BadRequestException(
			'An Activepieces MCP 2.0 server is the project’s one server, with no name or tool list of its own: update its disabledTools instead.'
		);
	}
	return updateData?.disabledTools !== undefined ? { disabledTools: [...updateData.disabledTools] } : {};
}
