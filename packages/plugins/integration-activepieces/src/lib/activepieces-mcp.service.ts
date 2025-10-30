import { Injectable, BadRequestException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
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

@Injectable()
export class ActivepiecesMcpService {
	private readonly logger = new Logger(ActivepiecesMcpService.name);

	constructor(
		private readonly httpService: HttpService,
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
			if (!serverId?.trim()) {
				throw new BadRequestException('serverId is required');
			}
			return await this.request<IActivepiecesMcpServer>(
				'get',
				`${ACTIVEPIECES_MCP_SERVERS_URL}/${encodeURIComponent(serverId)}`
			);
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
			const result = await this.request<IActivepiecesMcpServer>(
				'post',
				`${ACTIVEPIECES_MCP_SERVERS_URL}/${serverId}`,
				updateData
			);

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
				`${ACTIVEPIECES_MCP_SERVERS_URL}/${serverId}/rotate`,
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
		const accessToken = await this.getValidAccessToken();

		const config = {
			headers: {
				Authorization: `Bearer ${accessToken}`,
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
	 * Get valid access token for API calls
	 */
	private async getValidAccessToken(): Promise<string> {
		try {
			// This method would need to be updated to get the token from the appropriate integration
			// For now, we'll use a similar approach as the main service
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			// Find the ActivePieces integration for this tenant
			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: {
					tenantId,
					integration: {
						provider: IntegrationEnum.ACTIVE_PIECES
					}
				},
				relations: ['settings']
			});

			if (!integrationTenant) {
				throw new BadRequestException('ActivePieces integration not found for this tenant');
			}

			const tokenSetting = integrationTenant.settings?.find(
				(setting) => setting.settingsName === ActivepiecesSettingName.ACCESS_TOKEN
			);

			if (!tokenSetting?.settingsValue) {
				throw new BadRequestException('Access token not found for this integration');
			}

			return tokenSetting.settingsValue;
		} catch (error: any) {
			this.logger.error('Failed to get valid access token:', error);
			if (error instanceof HttpException) {
				throw error;
			}
			throw new HttpException(
				`Failed to get valid access token: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
