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
import { IntegrationService, IntegrationTenantService, RequestContext } from '@gauzy/core';
import { IActivepiecesConfig } from '@gauzy/common';
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
} from '@gauzy/contracts';
import { ACTIVEPIECES_CONNECTIONS_URL, ACTIVEPIECES_PIECE_NAME } from './activepieces.config';

@Injectable()
export class ActivepiecesService {
	private readonly logger = new Logger(ActivepiecesService.name);

	constructor(
		private readonly httpService: HttpService,
		private readonly configService: ConfigService,
		private readonly integrationService: IntegrationService,
		private readonly integrationTenantService: IntegrationTenantService
	) {}

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
											data?.error?.message ??
												`Unauthorized to create ActivePieces connection: ${error.message}`
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
			const integrationTenant = await this.saveConnectionSettings(
				response.data,
				input.accessToken,
				tenantId,
				organizationId
			);

			this.logger.log(
				`ActivePieces connection Successfully upsert: ${response.data.id}. ` +
					`Integration tenant: ${integrationTenant.id}`
			);

			// Return both the connection data and the integration tenant ID
			return {
				...response.data,
				integrationId: integrationTenant.id
			};
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
	async listConnections(
		params: IActivepiecesConnectionsListParams,
		integrationId?: string
	): Promise<IActivepiecesConnectionsListResponse> {
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

			const response = await this.listConnections(
				{
					projectId,
					pieceName: ACTIVEPIECES_PIECE_NAME,
					scope: ActivepiecesConnectionScope.PROJECT
				},
				integrationId
			);

			// Filter connections by tenant metadata
			return response.data.filter((connection) => connection.metadata?.['tenantId'] === tenantId);
		} catch (error: any) {
			this.logger.error('Failed to get tenant connections:', error);
			throw new HttpException(
				`Failed to get tenant connections: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Get ActivePieces connection by integration tenant ID
	 */
	async getConnection(integrationTenantId: string): Promise<IActivepiecesConnection | null> {
		try {
			// Get integration tenant with settings
			const tenantId = RequestContext.currentTenantId();
			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: { id: integrationTenantId, tenantId: tenantId || undefined },
				relations: ['settings']
			});

			if (!integrationTenant) {
				return null;
			}

			// Find connection ID setting
			const connectionIdSetting = integrationTenant.settings?.find(
				(s: any) => s.settingsName === ActivepiecesSettingName.CONNECTION_ID
			);

			if (!connectionIdSetting?.settingsValue) {
				return null;
			}

			const accessToken = await this.getValidAccessToken(integrationTenantId);

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
	async deleteConnection(integrationTenantId: string): Promise<boolean> {
		try {
			// Get integration tenant with settings
			const tenantId = RequestContext.currentTenantId();
			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: { id: integrationTenantId, tenantId: tenantId || undefined },
				relations: ['settings']
			});

			if (!integrationTenant) {
				this.logger.warn(`Integration tenant not found: ${integrationTenantId}`);
				return false;
			}

			// Find connection ID setting
			const connectionIdSetting = integrationTenant.settings?.find(
				(s: any) => s.settingsName === ActivepiecesSettingName.CONNECTION_ID
			);

			if (!connectionIdSetting?.settingsValue) {
				this.logger.warn(`No connection ID found for integration tenant: ${integrationTenantId}`);
				return false;
			}

			const accessToken = await this.getValidAccessToken(integrationTenantId);

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
	 * @param integrationTenantId - The integration tenant ID (not the base integration ID)
	 */
	async getValidAccessToken(integrationTenantId: string): Promise<string> {
		try {
			this.logger.debug(`Looking for access token for integration tenant: ${integrationTenantId}`);

			// First, try to find the integration tenant to get its settings
			const tenantId = RequestContext.currentTenantId();
			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: { id: integrationTenantId, tenantId: tenantId || undefined },
				relations: ['settings']
			});

			if (!integrationTenant) {
				this.logger.error(`Integration tenant not found: ${integrationTenantId}`);
				throw new BadRequestException('Integration tenant not found');
			}

			this.logger.debug(`Integration tenant found. Settings count: ${integrationTenant.settings?.length || 0}`);

			// Log settings summary (only in non-production debug mode)
			if (integrationTenant.settings && process.env['NODE_ENV'] !== 'production') {
				// Only log setting keys (names), never values, to prevent accidental exposure
				const settingKeys = integrationTenant.settings.map((s: any) => s.settingsName).join(', ');
				this.logger.debug(`Available setting keys: ${settingKeys}`);
			}

			// Find the access token setting
			const accessTokenSetting = integrationTenant.settings?.find(
				(s: any) => s.settingsName === ActivepiecesSettingName.ACCESS_TOKEN
			);

			if (!accessTokenSetting?.settingsValue) {
				this.logger.error('Access token setting not found or empty');
				throw new BadRequestException('Access token not found for this integration');
			}

			this.logger.debug('Access token found successfully');
			return accessTokenSetting.settingsValue;
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
	 * Get project IDs for an integration tenant
	 */
	async getProjectIds(integrationTenantId: string): Promise<string[]> {
		try {
			// Get integration tenant with settings
			const tenantId = RequestContext.currentTenantId();
			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: { id: integrationTenantId, tenantId: tenantId || undefined },
				relations: ['settings']
			});

			if (!integrationTenant) {
				return [];
			}

			// Find project ID setting
			const projectIdSetting = integrationTenant.settings?.find(
				(s: any) => s.settingsName === ActivepiecesSettingName.PROJECT_ID
			);

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
	async isIntegrationEnabled(integrationTenantId: string): Promise<boolean> {
		try {
			// Get integration tenant with settings
			const tenantId = RequestContext.currentTenantId();
			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: { id: integrationTenantId, tenantId: tenantId || undefined },
				relations: ['settings']
			});

			if (!integrationTenant) {
				return false;
			}

			// Find enabled setting
			const enabledSetting = integrationTenant.settings?.find(
				(s: any) => s.settingsName === ActivepiecesSettingName.IS_ENABLED
			);

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
	 * Get configuration for a specific tenant and organization
	 * Falls back to global configuration if tenant-specific config is not found
	 */
	async getConfig(tenantId: string, organizationId?: string): Promise<IActivepiecesConfig> {
		try {
			// Try to get tenant-specific configuration from integration_settings
			try {
				const integrationTenant = await this.integrationTenantService.findOneByOptions({
					where: {
						tenantId,
						...(organizationId && { organizationId }),
						integration: { provider: IntegrationEnum.ACTIVE_PIECES }
					},
					relations: ['settings', 'integration']
				});

				if (integrationTenant?.settings) {
					const clientId = integrationTenant.settings.find(
						(s) => s.settingsName === ActivepiecesSettingName.CLIENT_ID
					)?.settingsValue;
					const clientSecret = integrationTenant.settings.find(
						(s) => s.settingsName === ActivepiecesSettingName.CLIENT_SECRET
					)?.settingsValue;
					const callbackUrl = integrationTenant.settings.find(
						(s) => s.settingsName === ActivepiecesSettingName.CALLBACK_URL
					)?.settingsValue;
					const postInstallUrl = integrationTenant.settings.find(
						(s) => s.settingsName === ActivepiecesSettingName.POST_INSTALL_URL
					)?.settingsValue;
					const stateSecret = integrationTenant.settings.find(
						(s) => s.settingsName === ActivepiecesSettingName.STATE_SECRET
					)?.settingsValue;

					if (clientId && clientSecret) {
						return {
							clientId,
							clientSecret,
							callbackUrl: callbackUrl || this.getDefaultCallbackUrl(),
							postInstallUrl: postInstallUrl || this.getDefaultPostInstallUrl(),
							stateSecret: stateSecret || this.getDefaultStateSecret()
						};
					}
				}
			} catch (findError) {
				// Log and continue to fallback - tenant-specific config not found
				this.logger.debug(
					`Tenant-specific config not found for tenant ${tenantId}, falling back to global config`
				);
			}

			// Fallback to global configuration
			const globalConfig = this.configService.get('activepieces');
			if (!globalConfig?.clientId || !globalConfig?.clientSecret) {
				throw new BadRequestException(
					'ActivePieces integration not configured(missing clientId or clientSecret)'
				);
			}

			return {
				clientId: globalConfig.clientId,
				clientSecret: globalConfig.clientSecret,
				callbackUrl: globalConfig.callbackUrl || this.getDefaultCallbackUrl(),
				postInstallUrl: globalConfig.postInstallUrl || this.getDefaultPostInstallUrl(),
				stateSecret: globalConfig.stateSecret || this.getDefaultStateSecret()
			};
		} catch (error: any) {
			this.logger.error('Failed to get ActivePieces configuration', error);
			throw error;
		}
	}

	/**
	 * Check if tenant has specific OAuth configuration
	 */
	async hasTenantConfig(tenantId: string, organizationId?: string): Promise<boolean> {
		try {
			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: {
					tenantId,
					...(organizationId && { organizationId }),
					integration: { provider: IntegrationEnum.ACTIVE_PIECES }
				},
				relations: ['settings', 'integration']
			});

			if (!integrationTenant?.settings) {
				return false;
			}

			const hasClientId = integrationTenant.settings.some((s) => s.settingsName === ActivepiecesSettingName.CLIENT_ID);
			const hasClientSecret = integrationTenant.settings.some((s) => s.settingsName === ActivepiecesSettingName.CLIENT_SECRET);

			return hasClientId && hasClientSecret;
		} catch (error) {
			this.logger.error('Failed to check if tenant has specific OAuth configuration:', error);
			return false;
		}
	}

	/**
	 * Save OAuth settings for a tenant/organization
	 */
	async saveOAuthSettings(
		clientId: string,
		clientSecret: string,
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
					settingsName: 'client_id',
					settingsValue: clientId,
					tenantId,
					organizationId
				},
				{
					settingsName: 'client_secret',
					settingsValue: clientSecret,
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
				`Successfully saved ActivePieces OAuth settings for tenant ${tenantId}. ` +
					`Integration tenant ID: ${integrationTenant.id}`
			);

			return integrationTenant;
		} catch (error: any) {
			this.logger.error('Failed to save ActivePieces OAuth settings:', error);
			throw new BadRequestException(`Failed to save OAuth settings: ${error.message}`);
		}
	}

	/**
	 * Get default callback URL from global configuration
	 */
	private getDefaultCallbackUrl(): string {
		const globalConfig = this.configService.get('activepieces');
		const apiBaseUrl = this.configService.get('baseUrl') ?? process.env['API_BASE_URL'];
		if (!apiBaseUrl) {
			throw new BadRequestException('API base URL not found');
		}
		return globalConfig?.callbackUrl || `${apiBaseUrl}/api/integration/activepieces/callback`;
	}

	/**
	 * Get default post-install URL from global configuration
	 */
	private getDefaultPostInstallUrl(): string {
		const globalConfig = this.configService.get('activepieces');
		const clientBaseUrl = this.configService.get('clientBaseUrl') ?? process.env['CLIENT_BASE_URL'];
		if (!clientBaseUrl) {
			throw new BadRequestException('Client base URL not found');
		}
		return globalConfig?.postInstallUrl || `${clientBaseUrl}/#/pages/integrations/activepieces/callback`;
	}

	/**
	 * Get default state secret from global configuration
	 */
	private getDefaultStateSecret(): string {
		const globalConfig = this.configService.get('activepieces');
		if (!globalConfig?.stateSecret) {
			throw new BadRequestException('State secret not found');
		}
		return globalConfig?.stateSecret;
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
