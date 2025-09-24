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
import { IntegrationEnum } from '@gauzy/contracts';
import { IntegrationSettingService, IntegrationService, IntegrationTenantService, RequestContext } from '@gauzy/core';
import {
	IActivepiecesConnection,
	IActivepiecesConnectionRequest,
	IActivepiecesConnectionsListResponse,
	IActivepiecesConnectionsListParams,
	ActivepiecesSettingName,
	ActivepiecesConnectionType,
	ActivepiecesConnectionScope,
	ICreateActivepiecesIntegrationInput,
	IActivepiecesErrorResponse
} from './activepieces.type';
import { ACTIVEPIECES_CONNECTIONS_URL, ACTIVEPIECES_PIECE_NAME } from './activepieces.config';

@Injectable()
export class ActivepiecesService {
	private readonly logger = new Logger(ActivepiecesService.name);

	constructor(
		private readonly httpService: HttpService,
		private readonly configService: ConfigService,
		private readonly integrationSettingService: IntegrationSettingService,
		private readonly integrationService: IntegrationService,
		private readonly integrationTenantService: IntegrationTenantService
	) { }

	/**
	 * Create or update ActivePieces connection for the tenant (using upsert endpoint)
	 */
	async upsertConnection(input: ICreateActivepiecesIntegrationInput): Promise<IActivepiecesConnection> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const organizationId = input.organizationId;

			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			// Get ActivePieces OAuth credentials from configuration
			const clientId = this.configService.get('activepieces')?.clientId;
			const clientSecret = this.configService.get('activepieces')?.clientSecret;

			if (!clientId || !clientSecret) {
				throw new BadRequestException('ActivePieces OAuth credentials are not configured');
			}

			// Create external ID for the connection (unique identifier for this tenant)
			const externalId = `gauzy-tenant-${tenantId}${organizationId ? `-org-${organizationId}` : ''}`;

			// Create display name for the connection
			const displayName = input.connectionName || `Ever Gauzy - ${tenantId}`;

			// Prepare the connection request for ActivePieces (upsert format)
			const connectionRequest: IActivepiecesConnectionRequest = {
				externalId,
				displayName,
				pieceName: ACTIVEPIECES_PIECE_NAME,
				projectId: input.projectId,
				metadata: {
					tenantId,
					organizationId: organizationId || 'default',
					createdAt: new Date().toISOString(),
					gauzyVersion: '1.0.0'
				},
				type: ActivepiecesConnectionType.OAUTH2,
				value: {
					type: ActivepiecesConnectionType.OAUTH2,
					client_id: clientId,
					client_secret: clientSecret,
					data: {
						tenantId,
						organizationId: organizationId || 'default',
						accessToken: input.accessToken
					}
				}
			};

			// Make the API call to create the connection
			const response = await firstValueFrom(
				this.httpService
					.post<IActivepiecesConnection>(ACTIVEPIECES_CONNECTIONS_URL, connectionRequest, {
						headers: {
							Authorization: `Bearer ${input.accessToken}`,
							'Content-Type': 'application/json'
						}
					})
					.pipe(
						catchError((error) => {
							const status = error?.response?.status;
							const data = error?.response?.data as IActivepiecesErrorResponse;
							const errorMessage = data?.error?.message || error.message;

							this.logger.error('Error creating ActivePieces connection:', data);

							if (status === HttpStatus.UNAUTHORIZED) {
								return throwError(
									() =>
										new UnauthorizedException(
											data?.error?.message ?? `Unauthorized to create ActivePieces connection: ${error.message}`
										)
								);
							}

							// Optionally wrap and throw a more descriptive internal server error
							return throwError(
								() =>
									new InternalServerErrorException(
										`Failed to create ActivePieces connection: ${errorMessage}`
									)
							);
						})
					)
			);

			// Save the connection details to the database
			const integrationTenant = await this.saveConnectionSettings(response.data, input.accessToken, tenantId, organizationId);

			this.logger.log(
				`ActivePieces connection Successfully upsert: ${response.data.id}. ` +
				`Integration tenant: ${integrationTenant.id}`
			);

			return response.data;
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to upsert ActivePieces connection:', error);
			throw new InternalServerErrorException(`Failed to upsert connection: ${error.message}`);
		}
	}

	/**
	 * List ActivePieces connections for a project
	 */
	async listConnections(params: IActivepiecesConnectionsListParams, integrationId?: string): Promise<IActivepiecesConnectionsListResponse> {
		try {
			// We need an integration ID to get the access token
			if (!integrationId) {
				throw new BadRequestException('Integration ID is required to list connections');
			}
			const accessToken = await this.getValidAccessToken(integrationId);

			// Build query parameters
			const queryParams = new URLSearchParams();
			queryParams.append('projectId', params.projectId);

			if (params.cursor) queryParams.append('cursor', params.cursor);
			if (params.scope) queryParams.append('scope', params.scope);
			if (params.pieceName) queryParams.append('pieceName', params.pieceName);
			if (params.displayName) queryParams.append('displayName', params.displayName);
			if (params.status) queryParams.append('status', params.status);
			if (params.limit) queryParams.append('limit', params.limit.toString());

			const response = await firstValueFrom(
				this.httpService
					.get<IActivepiecesConnectionsListResponse>(
						`${ACTIVEPIECES_CONNECTIONS_URL}?${queryParams.toString()}`,
						{
							headers: {
								Authorization: `Bearer ${accessToken}`,
								'Content-Type': 'application/json'
							}
						}
					)
					.pipe(
						catchError((error: AxiosError) => {
							this.logger.error('Error listing ActivePieces connections:', error.response?.data);
							throw new HttpException(
								`Failed to list ActivePieces connections: ${error.message}`,
								error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
							);
						})
					)
			);

			return response.data;
		} catch (error: any) {
			this.logger.error('Failed to list ActivePieces connections:', error);
			throw new HttpException(
				`Failed to list ActivePieces connections: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Get connections for current tenant
	 */
	async getTenantConnections(projectId: string, integrationId: string): Promise<IActivepiecesConnection[]> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			const response = await this.listConnections({
				projectId,
				pieceName: ACTIVEPIECES_PIECE_NAME,
				scope: ActivepiecesConnectionScope.PROJECT
			}, integrationId);

			// Filter connections by tenant metadata
			return response.data.filter(connection =>
				connection.metadata?.['tenantId'] === tenantId
			);
		} catch (error: any) {
			this.logger.error('Failed to get tenant connections:', error);
			throw new HttpException(
				`Failed to get tenant connections: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Get ActivePieces connection by integration ID
	 */
	async getConnection(integrationId: string): Promise<IActivepiecesConnection | null> {
		try {
			const connectionIdSetting = await this.integrationSettingService.findOneByOptions({
				where: {
					integration: { id: integrationId },
					settingsName: ActivepiecesSettingName.CONNECTION_ID
				}
			});

			if (!connectionIdSetting?.settingsValue) {
				return null;
			}

			const accessToken = await this.getValidAccessToken(integrationId);

			const response = await firstValueFrom(
				this.httpService
					.get<IActivepiecesConnection>(
						`${ACTIVEPIECES_CONNECTIONS_URL}/${connectionIdSetting.settingsValue}`,
						{
							headers: {
								Authorization: `Bearer ${accessToken}`,
								'Content-Type': 'application/json'
							}
						}
					)
					.pipe(
						catchError((error: AxiosError) => {
							this.logger.error('Error fetching ActivePieces connection:', error.response?.data);
							throw new HttpException(
								`Failed to fetch ActivePieces connection: ${error.message}`,
								error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
							);
						})
					)
			);

			return response.data;
		} catch (error: any) {
			this.logger.error('Failed to get ActivePieces connection:', error);
			throw new HttpException(
				`Failed to get ActivePieces connection: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Delete ActivePieces connection
	 */
	async deleteConnection(integrationId: string): Promise<boolean> {
		try {
			const connectionIdSetting = await this.integrationSettingService.findOneByOptions({
				where: {
					integration: { id: integrationId },
					settingsName: ActivepiecesSettingName.CONNECTION_ID
				}
			});

			if (!connectionIdSetting?.settingsValue) {
				this.logger.warn(`No connection ID found for integration: ${integrationId}`);
				return false;
			}

			const accessToken = await this.getValidAccessToken(integrationId);

			await firstValueFrom(
				this.httpService
					.delete(`${ACTIVEPIECES_CONNECTIONS_URL}/${connectionIdSetting.settingsValue}`, {
						headers: {
							Authorization: `Bearer ${accessToken}`,
							'Content-Type': 'application/json'
						}
					})
					.pipe(
						catchError((error: AxiosError) => {
							this.logger.error('Error deleting ActivePieces connection:', error.response?.data);
							throw new HttpException(
								`Failed to delete ActivePieces connection: ${error.message}`,
								error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
							);
						})
					)
			);

			this.logger.log(`Successfully deleted ActivePieces connection: ${connectionIdSetting.settingsValue}`);
			return true;
		} catch (error: any) {
			this.logger.error('Failed to delete ActivePieces connection:', error);
			throw new HttpException(
				`Failed to delete Activepieces connection: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Get valid access token for API calls
	 */
	async getValidAccessToken(integrationId: string): Promise<string> {
		try {
			const tokenSetting = await this.integrationSettingService.findOneByOptions({
				where: {
					integration: { id: integrationId },
					settingsName: ActivepiecesSettingName.ACCESS_TOKEN
				}
			});

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

	/**
	 * Get project IDs for an integration
	 */
	async getProjectIds(integrationId: string): Promise<string[]> {
		try {
			const projectIdSetting = await this.integrationSettingService.findOneByOptions({
				where: {
					integration: { id: integrationId },
					settingsName: ActivepiecesSettingName.PROJECT_ID
				}
			});

			if (!projectIdSetting?.settingsValue) {
				return [];
			}

			try {
				return JSON.parse(projectIdSetting.settingsValue);
			} catch (error) {
				// Handle case where it might be a single project ID stored as string
				return [projectIdSetting.settingsValue];
			}
		} catch (error: any) {
			this.logger.error('Failed to get project IDs:', error);
			return [];
		}
	}

	/**
	 * Check if ActivePieces integration is enabled
	 */
	async isIntegrationEnabled(integrationId: string): Promise<boolean> {
		try {
			const enabledSetting = await this.integrationSettingService.findOneByOptions({
				where: {
					integration: { id: integrationId },
					settingsName: ActivepiecesSettingName.IS_ENABLED
				}
			});

			if (typeof enabledSetting?.settingsValue === 'boolean') {
				return enabledSetting.settingsValue;
			}
			return !!(typeof enabledSetting?.settingsValue === 'string'
				? JSON.parse(enabledSetting.settingsValue)
				: enabledSetting?.settingsValue);
		} catch (error) {
			this.logger.error('Error checking if integration is enabled:', error);
			return false;
		}
	}

	/**
	 * Get integration tenant information
	 */
	async getIntegrationTenant(integrationId: string): Promise<any> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			return await this.integrationTenantService.findOneByOptions({
				where: {
					tenantId,
					integration: { id: integrationId }
				},
				relations: ['integration', 'settings']
			});
		} catch (error: any) {
			this.logger.error('Failed to get integration tenant:', error);
			throw new HttpException(
				`Failed to get integration tenant: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Save connection settings to the database
	 */
	private async saveConnectionSettings(
		connection: IActivepiecesConnection,
		accessToken: string,
		tenantId: string,
		organizationId?: string
	): Promise<any> {
		try {
			// Find or create the integration
			let integration = await this.integrationService.findOneByOptions({
				where: { provider: IntegrationEnum.ACTIVE_PIECES }
			});

			if (!integration) {
				integration = await this.integrationService.create({
					provider: IntegrationEnum.ACTIVE_PIECES,
					name: IntegrationEnum.ACTIVE_PIECES
				});
			}

			// Define the settings to save
			const settings = [
				{
					settingsName: ActivepiecesSettingName.ACCESS_TOKEN,
					settingsValue: accessToken,
					tenantId,
					organizationId
				},
				{
					settingsName: ActivepiecesSettingName.CONNECTION_ID,
					settingsValue: connection.id,
					tenantId,
					organizationId
				},
				{
					settingsName: ActivepiecesSettingName.PROJECT_ID,
					settingsValue: JSON.stringify(connection.projectIds), // Serialize array to string
					tenantId,
					organizationId
				},
				{
					settingsName: ActivepiecesSettingName.IS_ENABLED,
					settingsValue: JSON.stringify(true),
					tenantId,
					organizationId
				}
			];

			// Create or update integration tenant
			const integrationTenant = await this.integrationTenantService.create({
				name: IntegrationEnum.ACTIVE_PIECES,
				integration,
				tenantId,
				organizationId,
				settings
			});

			this.logger.log(
				`Successfully saved ActivePieces connection settings for tenant ${tenantId}. ` +
				`Integration tenant ID: ${integrationTenant.id}, ` +
				`Connection ID: ${connection.id}`
			);

			// Return the integration tenant for potential future use
			return integrationTenant;
		} catch (error: any) {
			this.logger.error('Failed to save ActivePieces connection settings:', error);
			throw new BadRequestException(`Failed to save connection settings: ${error.message}`);
		}
	}
}
