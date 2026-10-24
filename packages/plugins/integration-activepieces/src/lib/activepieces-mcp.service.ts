import { Injectable, BadRequestException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@gauzy/config';
import { IntegrationEnum } from '@gauzy/contracts';
import { firstValueFrom, catchError } from 'rxjs';
import { AxiosError } from 'axios';
import { IntegrationTenantService, RequestContext } from '@gauzy/core';
import {
	IActivepiecesMcpServer,
	IActivepiecesMcpServersListResponse,
	IActivepiecesMcpServersListParams,
	ActivepiecesSettingName
} from '@gauzy/contracts';
import { ActivepiecesMcpUpdateDto } from './dto';
import { ACTIVEPIECES_MCP_SERVERS_URL } from './activepieces.config';

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
		private readonly integrationTenantService: IntegrationTenantService
	) {}

	/**
	 * List MCP servers for a project
	 */
	async listMcpServers(params: IActivepiecesMcpServersListParams): Promise<IActivepiecesMcpServersListResponse> {
		try {
			// Build query parameters
			const queryParams: Record<string, unknown> = {
				projectId: params.projectId
			};

			if (params.limit) queryParams['limit'] = params.limit.toString();
			if (params.cursor) queryParams['cursor'] = params.cursor;
			if (params.name) queryParams['name'] = params.name;

			return await this.request<IActivepiecesMcpServersListResponse>(
				'get',
				ACTIVEPIECES_MCP_SERVERS_URL,
				undefined,
				queryParams
			);
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
	 */
	async getMcpServer(serverId: string): Promise<IActivepiecesMcpServer> {
		try {
			return await this.request<IActivepiecesMcpServer>('get', mcpServerUrl(serverId));
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
	 */
	async updateMcpServer(serverId: string, updateData: ActivepiecesMcpUpdateDto): Promise<IActivepiecesMcpServer> {
		try {
			const result = await this.request<IActivepiecesMcpServer>('post', mcpServerUrl(serverId), updateData);

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
	 */
	async rotateMcpServerToken(serverId: string): Promise<IActivepiecesMcpServer> {
		try {
			const result = await this.request<IActivepiecesMcpServer>(
				'post',
				`${mcpServerUrl(serverId)}/rotate`,
				{} // No body required for rotate
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
	async getTenantMcpServers(projectId: string): Promise<IActivepiecesMcpServer[]> {
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
	 * Helper method for making HTTP requests with standard headers and error handling
	 */
	private async request<T>(
		method: 'get' | 'post' | 'put' | 'delete',
		url: string,
		data?: unknown,
		params?: Record<string, unknown>
	): Promise<T> {
		const apiKey = await this.getApiKey();

		const config = {
			headers: {
				Authorization: `Bearer ${apiKey}`,
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
	 * Get API key for Activepieces API calls.
	 * Looks for a tenant-specific API key in the database first, then falls back to global config.
	 */
	private async getApiKey(): Promise<string> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			// 1. Try tenant-specific API key from database, from any of the tenant's rows that holds one,
			// since connection calls used to add rows without an API key
			const integrationTenants: any[] = await this.integrationTenantService.find({
				where: {
					tenantId,
					integration: { provider: IntegrationEnum.ACTIVE_PIECES }
				},
				relations: ['settings']
			});

			const apiKeySetting = integrationTenants
				.flatMap((integrationTenant: any) => integrationTenant.settings ?? [])
				.find(
					(setting: any) => setting.settingsName === ActivepiecesSettingName.API_KEY && setting.settingsValue
				);

			if (apiKeySetting?.settingsValue) {
				return apiKeySetting.settingsValue;
			}

			// 2. Fallback to global config
			const globalApiKey = this.configService.get('activepieces')?.apiKey;
			if (globalApiKey) {
				return globalApiKey;
			}

			throw new BadRequestException('Activepieces API key not configured');
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
