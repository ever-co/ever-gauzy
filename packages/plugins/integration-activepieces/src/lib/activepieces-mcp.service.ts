import {
	Injectable,
	BadRequestException,
	Logger,
	HttpException,
	HttpStatus,
	UnauthorizedException,
	InternalServerErrorException
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@gauzy/config';
import { firstValueFrom, catchError, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { IntegrationSettingService, IntegrationService, IntegrationTenantService, RequestContext } from '@gauzy/core';
import {
	IActivepiecesMcpServer,
	IActivepiecesMcpServersListResponse,
	IActivepiecesMcpServersListParams,
	IActivepiecesMcpServerUpdateRequest,
	ActivepiecesSettingName,
	IActivepiecesErrorResponse
} from './activepieces.type';
import { ACTIVEPIECES_MCP_SERVERS_URL } from './activepieces.config';

@Injectable()
export class ActivepiecesMcpService {
	private readonly logger = new Logger(ActivepiecesMcpService.name);

	constructor(
		private readonly httpService: HttpService,
		private readonly configService: ConfigService,
		private readonly integrationSettingService: IntegrationSettingService,
		private readonly integrationService: IntegrationService,
		private readonly integrationTenantService: IntegrationTenantService
	) { }

	/**
	 * List MCP servers for a project
	 */
	async listMcpServers(params: IActivepiecesMcpServersListParams): Promise<IActivepiecesMcpServersListResponse> {
		try {
			const accessToken = await this.getValidAccessToken();

			// Build query parameters
			const queryParams = new URLSearchParams();
			queryParams.append('projectId', params.projectId);

			if (params.limit) queryParams.append('limit', params.limit.toString());
			if (params.cursor) queryParams.append('cursor', params.cursor);
			if (params.name) queryParams.append('name', params.name);

			const response = await firstValueFrom(
				this.httpService
					.get<IActivepiecesMcpServersListResponse>(
						`${ACTIVEPIECES_MCP_SERVERS_URL}?${queryParams.toString()}`,
						{
							headers: {
								Authorization: `Bearer ${accessToken}`,
								'Content-Type': 'application/json'
							}
						}
					)
					.pipe(
						catchError((error: AxiosError) => {
							this.logger.error('Error listing ActivePieces MCP servers:', error.response?.data);
							throw new HttpException(
								`Failed to list ActivePieces MCP servers: ${error.message}`,
								error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
							);
						})
					)
			);

			return response.data;
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
			const accessToken = await this.getValidAccessToken();

			const response = await firstValueFrom(
				this.httpService
					.get<IActivepiecesMcpServer>(
						`${ACTIVEPIECES_MCP_SERVERS_URL}/${serverId}`,
						{
							headers: {
								Authorization: `Bearer ${accessToken}`,
								'Content-Type': 'application/json'
							}
						}
					)
					.pipe(
						catchError((error: AxiosError) => {
							this.logger.error('Error fetching ActivePieces MCP server:', error.response?.data);
							throw new HttpException(
								`Failed to fetch ActivePieces MCP server: ${error.message}`,
								error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
							);
						})
					)
			);

			return response.data;
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
	async updateMcpServer(serverId: string, updateData: IActivepiecesMcpServerUpdateRequest): Promise<IActivepiecesMcpServer> {
		try {
			const accessToken = await this.getValidAccessToken();

			const response = await firstValueFrom(
				this.httpService
					.post<IActivepiecesMcpServer>(
						`${ACTIVEPIECES_MCP_SERVERS_URL}/${serverId}`,
						updateData,
						{
							headers: {
								Authorization: `Bearer ${accessToken}`,
								'Content-Type': 'application/json'
							}
						}
					)
					.pipe(
						catchError((error: AxiosError) => {
							const status = error?.response?.status;
							const data = error?.response?.data as IActivepiecesErrorResponse;
							const errorMessage = data?.error?.message || error.message;

							this.logger.error('Error updating ActivePieces MCP server:', data);

							if (status === HttpStatus.UNAUTHORIZED) {
								return throwError(
									() =>
										new UnauthorizedException(
											data?.error?.message ?? `Unauthorized to update ActivePieces MCP server: ${error.message}`
										)
								);
							}

							return throwError(
								() =>
									new InternalServerErrorException(
										`Failed to update ActivePieces MCP server: ${errorMessage}`
									)
							);
						})
					)
			);

			this.logger.log(`Successfully updated ActivePieces MCP server: ${response.data.id}`);
			return response.data;
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
			const accessToken = await this.getValidAccessToken();

			const response = await firstValueFrom(
				this.httpService
					.post<IActivepiecesMcpServer>(
						`${ACTIVEPIECES_MCP_SERVERS_URL}/${serverId}/rotate`,
						{}, // No body required for rotate
						{
							headers: {
								Authorization: `Bearer ${accessToken}`,
								'Content-Type': 'application/json'
							}
						}
					)
					.pipe(
						catchError((error: AxiosError) => {
							const status = error?.response?.status;
							const data = error?.response?.data as IActivepiecesErrorResponse;
							const errorMessage = data?.error?.message || error.message;

							this.logger.error('Error rotating ActivePieces MCP server token:', data);

							if (status === HttpStatus.UNAUTHORIZED) {
								return throwError(
									() =>
										new UnauthorizedException(
											data?.error?.message ?? `Unauthorized to rotate ActivePieces MCP server token: ${error.message}`
										)
								);
							}

							return throwError(
								() =>
									new InternalServerErrorException(
										`Failed to rotate ActivePieces MCP server token: ${errorMessage}`
									)
							);
						})
					)
			);

			this.logger.log(`Successfully rotated ActivePieces MCP server token: ${response.data.id}`);
			return response.data;
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
			return response.data.filter(server =>
				server.name.includes(tenantId) ||
				server.name.includes('gauzy')
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
						provider: 'ACTIVE_PIECES'
					}
				},
				relations: ['settings']
			});

			if (!integrationTenant) {
				throw new BadRequestException('ActivePieces integration not found for this tenant');
			}

			const tokenSetting = integrationTenant.settings?.find(
				setting => setting.settingsName === ActivepiecesSettingName.ACCESS_TOKEN
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