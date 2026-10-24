import { Injectable, BadRequestException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@gauzy/config';
import { firstValueFrom, catchError } from 'rxjs';
import { AxiosError } from 'axios';
import { IntegrationTenantService, RequestContext } from '@gauzy/core';
import {
	IActivepiecesMcpServer,
	IActivepiecesMcpServersListResponse,
	IActivepiecesMcpServersListParams
} from '@gauzy/contracts';
import { ActivepiecesMcpUpdateDto } from './dto';
import { ACTIVEPIECES_MCP_SERVERS_URL } from './activepieces.config';
import { ActivepiecesCredentialsService, IActivepiecesCredential } from './activepieces-credentials.service';

/**
 * The query of an MCP server list. `projectId` is optional: in the modes that pin the tenant's own project, the server
 * names it; with the tenant's own key, the client must.
 */
export type ActivepiecesMcpServersListInput = Omit<IActivepiecesMcpServersListParams, 'projectId'> & {
	projectId?: string;
};

/**
 * The Activepieces URL of one MCP server. The id is the caller's, from the route, and Express decodes `%2F` in a route
 * parameter: unencoded, `..%2F..%2F<path>` turned the update and the token rotation into POSTs to any other path of the
 * Activepieces API, under the installation's key when the tenant has none of its own. `encodeURIComponent` leaves dots
 * alone, so `.` and `..` (`%2E%2E` in the route) are refused: the HTTP client resolves them as path segments, to the
 * server list or to the API's root.
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

@Injectable()
export class ActivepiecesMcpService {
	private readonly logger = new Logger(ActivepiecesMcpService.name);

	constructor(
		private readonly httpService: HttpService,
		private readonly configService: ConfigService,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly credentials: ActivepiecesCredentialsService
	) {}

	/**
	 * List MCP servers for a project
	 *
	 * In the modes that pin the tenant's own project, that project is listed whatever the client named (another one is
	 * refused), and only its servers are returned.
	 */
	async listMcpServers(params: ActivepiecesMcpServersListInput): Promise<IActivepiecesMcpServersListResponse> {
		try {
			const credential = await this.getCredential();
			const projectId = this.credentials.projectFor(credential, params.projectId);

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
					data: (result?.data ?? []).filter((server) => this.credentials.isInProject(credential, server?.projectId))
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
	 * In the modes that pin the tenant's own project, a server of another project is answered as missing.
	 */
	async getMcpServer(serverId: string): Promise<IActivepiecesMcpServer> {
		try {
			const url = mcpServerUrl(serverId);
			const credential = await this.getCredential();
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
	 * In the modes that pin the tenant's own project, the server is first checked to be in it.
	 */
	async updateMcpServer(serverId: string, updateData: ActivepiecesMcpUpdateDto): Promise<IActivepiecesMcpServer> {
		try {
			const url = mcpServerUrl(serverId);
			const credential = await this.getCredential();
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
	 * In the modes that pin the tenant's own project, the server is first checked to be in it.
	 */
	async rotateMcpServerToken(serverId: string): Promise<IActivepiecesMcpServer> {
		try {
			const url = mcpServerUrl(serverId);
			const credential = await this.getCredential();
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
	 * Get MCP servers for current tenant
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

			// Filter MCP servers by tenant (if they have tenant-specific naming or metadata)
			return response.data.filter((server) => server.name.includes(tenantId) || server.name.includes('gauzy'));
		} catch (error: any) {
			this.logger.error('Failed to get tenant MCP servers:', error);
			throw new HttpException(
				`Failed to get tenant MCP servers: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
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
						throw new HttpException(`HTTP ${method.toUpperCase()} request failed: ${message}`, status);
					})
				)
		).then((response) => response.data);
	}

	/**
	 * The credential of the current tenant's MCP calls: its own key (from any of its rows holding one, since connection
	 * calls used to add rows without a key), else its project token, else the installation's key pinned to the tenant's
	 * own project. It used to fall back to the installation's key unconfined, with the project and the server ids taken
	 * from the client: any tenant could list, read, change or rotate the MCP servers of any project of the platform.
	 */
	private async getCredential(): Promise<IActivepiecesCredential> {
		try {
			return await this.credentials.resolve();
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
