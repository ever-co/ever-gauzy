import { Injectable, BadRequestException, Logger, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
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

			// 1. Try tenant-specific API key from database
			let integrationTenant: any = null;
			try {
				integrationTenant = await this.integrationTenantService.findOneByOptions({
					where: {
						tenantId,
						integration: { provider: IntegrationEnum.ACTIVE_PIECES }
					},
					relations: ['settings']
				});
			} catch (error) {
				if (!(error instanceof NotFoundException)) {
					throw error;
				}
			}

			const apiKeySetting = integrationTenant?.settings?.find(
				(setting: any) => setting.settingsName === ActivepiecesSettingName.API_KEY
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
