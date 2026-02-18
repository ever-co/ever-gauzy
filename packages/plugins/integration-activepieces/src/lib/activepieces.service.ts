import {
	Injectable,
	BadRequestException,
	Logger,
	HttpException,
	HttpStatus,
	NotFoundException,
	UnauthorizedException,
	InternalServerErrorException
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@gauzy/config';
import { firstValueFrom, catchError, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { IntegrationEnum } from '@gauzy/contracts';
import { IntegrationService, IntegrationTenantService, RequestContext } from '@gauzy/core';
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
	 * Set up the ActivePieces integration by saving the API key.
	 * Finds or creates the ACTIVE_PIECES integration record and creates an integration tenant
	 * with API_KEY and IS_ENABLED settings.
	 */
	async setupIntegration(apiKey: string, organizationId?: string): Promise<{ integrationTenantId: string }> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			// Find or create the integration
			let integration: any = null;
			try {
				integration = await this.integrationService.findOneByOptions({
					where: { provider: IntegrationEnum.ACTIVE_PIECES }
				});
			} catch (error) {
				if (!(error instanceof NotFoundException)) {
					throw error;
				}
			}

			if (!integration) {
				integration = await this.integrationService.create({
					provider: IntegrationEnum.ACTIVE_PIECES,
					name: IntegrationEnum.ACTIVE_PIECES
				});
			}

			// Define the settings to save
			const settings = [
				{
					settingsName: ActivepiecesSettingName.API_KEY,
					settingsValue: apiKey,
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

			// Look up an existing integration tenant for this tenant/org
			let existingTenant: any = null;
			try {
				existingTenant = await this.integrationTenantService.findOneByOptions({
					where: {
						tenantId,
						...(organizationId ? { organizationId } : {}),
						integration: { provider: IntegrationEnum.ACTIVE_PIECES }
					},
					relations: ['settings']
				});
			} catch (error) {
				if (!(error instanceof NotFoundException)) {
					throw error;
				}
			}

			let integrationTenantId: string;

			if (existingTenant?.id) {
				// Update existing tenant's settings by merging/replacing API_KEY and IS_ENABLED
				const existingSettings: any[] = existingTenant.settings ?? [];
				const settingsByName = new Map(settings.map((s) => [s.settingsName, s]));

				// Update existing rows in-place (preserve their database id) and track which were updated
				const updatedNames = new Set<string>();
				const mergedSettings = existingSettings.map((existing: any) => {
					const update = settingsByName.get(existing.settingsName);
					if (update) {
						updatedNames.add(existing.settingsName);
						return { ...existing, settingsValue: update.settingsValue };
					}
					return existing;
				});

				// Append truly new settings that had no pre-existing row
				for (const [name, setting] of settingsByName) {
					if (!updatedNames.has(name)) {
						mergedSettings.push(setting);
					}
				}

				await this.integrationTenantService.save({
					...existingTenant,
					settings: mergedSettings
				});

				integrationTenantId = existingTenant.id;
			} else {
				// Create a new integration tenant
				const integrationTenant = await this.integrationTenantService.create({
					name: IntegrationEnum.ACTIVE_PIECES,
					integration,
					tenantId,
					organizationId,
					settings
				});

				if (!integrationTenant.id) {
					throw new BadRequestException('Failed to create integration tenant: missing ID');
				}

				integrationTenantId = integrationTenant.id;
			}

			this.logger.log(
				`Successfully set up ActivePieces integration for tenant ${tenantId}. ` +
					`Integration tenant ID: ${integrationTenantId}`
			);

			return { integrationTenantId };
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to set up ActivePieces integration:', error);
			throw new InternalServerErrorException('Failed to set up ActivePieces integration');
		}
	}

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

			// Create external ID for the connection (unique identifier for this tenant)
			const externalId = `gauzy-tenant-${tenantId}${organizationId ? `-org-${organizationId}` : ''}`;

			// Create display name for the connection
			const displayName = input.connectionName || `Ever Gauzy - ${tenantId}`;

			// Prepare the connection request for ActivePieces (upsert format with SECRET_TEXT)
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
				type: ActivepiecesConnectionType.SECRET_TEXT,
				value: {
					type: ActivepiecesConnectionType.SECRET_TEXT,
					secret_text: input.accessToken
				}
			};

			// Get API key for Activepieces API calls
			let existingIntegrationTenant: any = null;
			try {
				existingIntegrationTenant = await this.integrationTenantService.findOneByOptions({
					where: {
						tenantId,
						integration: { provider: IntegrationEnum.ACTIVE_PIECES }
					}
				});
			} catch (error) {
				if (!(error instanceof NotFoundException)) {
					throw error;
				}
			}

			if (!existingIntegrationTenant) {
				this.logger.warn(
					`No integration tenant found for tenant ${tenantId}. ` +
						'setupIntegration was likely not run; falling back to global GAUZY_ACTIVEPIECES_API_KEY env variable.'
				);
			}

			const apiKey = await this.getApiKey(existingIntegrationTenant?.id);

			// Make the API call to create the connection
			const response = await firstValueFrom(
				this.httpService
					.post<IActivepiecesConnection>(ACTIVEPIECES_CONNECTIONS_URL, connectionRequest, {
						headers: {
							Authorization: `Bearer ${apiKey}`,
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
			const apiKey = await this.getApiKey(integrationId);

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
								Authorization: `Bearer ${apiKey}`,
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
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			let integrationTenant: any = null;
			try {
				integrationTenant = await this.integrationTenantService.findOneByOptions({
					where: { id: integrationTenantId, tenantId },
					relations: ['settings']
				});
			} catch (error) {
				if (!(error instanceof NotFoundException)) {
					throw error;
				}
			}

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

			const apiKey = await this.getApiKey(integrationTenantId);

			const response = await firstValueFrom(
				this.httpService
					.get<IActivepiecesConnection>(
						`${ACTIVEPIECES_CONNECTIONS_URL}/${connectionIdSetting.settingsValue}`,
						{
							headers: {
								Authorization: `Bearer ${apiKey}`,
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
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			let integrationTenant: any = null;
			try {
				integrationTenant = await this.integrationTenantService.findOneByOptions({
					where: { id: integrationTenantId, tenantId },
					relations: ['settings']
				});
			} catch (error) {
				if (!(error instanceof NotFoundException)) {
					throw error;
				}
			}

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

			const apiKey = await this.getApiKey(integrationTenantId);

			await firstValueFrom(
				this.httpService
					.delete(`${ACTIVEPIECES_CONNECTIONS_URL}/${connectionIdSetting.settingsValue}`, {
						headers: {
							Authorization: `Bearer ${apiKey}`,
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
	 * Get API key for Activepieces API calls.
	 * Looks for a tenant-specific API key in the database first, then falls back to global config.
	 * @param integrationTenantId - The integration tenant ID (not the base integration ID)
	 */
	async getApiKey(integrationTenantId?: string): Promise<string> {
		try {
			// 1. Try tenant-specific API key from database
			if (integrationTenantId) {
				const tenantId = RequestContext.currentTenantId();
				if (!tenantId) {
					throw new BadRequestException('Tenant ID not found in request context');
				}

				let integrationTenant: any = null;
				try {
					integrationTenant = await this.integrationTenantService.findOneByOptions({
						where: { id: integrationTenantId, tenantId },
						relations: ['settings']
					});
				} catch (error) {
					if (!(error instanceof NotFoundException)) {
						throw error;
					}
				}

				const apiKeySetting = integrationTenant?.settings?.find(
					(s: any) => s.settingsName === ActivepiecesSettingName.API_KEY
				);

				if (apiKeySetting?.settingsValue) {
					return apiKeySetting.settingsValue;
				}
			}

			// 2. Fallback to global config
			const globalApiKey = this.configService.get('activepieces')?.apiKey;
			if (globalApiKey) {
				return globalApiKey;
			}

			throw new InternalServerErrorException(
				'Activepieces API key is not configured. Set GAUZY_ACTIVEPIECES_API_KEY or run setupIntegration first.'
			);
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

	/**
	 * Get project IDs for an integration tenant
	 */
	async getProjectIds(integrationTenantId: string): Promise<string[]> {
		try {
			// Get integration tenant with settings
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			let integrationTenant: any = null;
			try {
				integrationTenant = await this.integrationTenantService.findOneByOptions({
					where: { id: integrationTenantId, tenantId },
					relations: ['settings']
				});
			} catch (error) {
				if (!(error instanceof NotFoundException)) {
					throw error;
				}
			}

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
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			let integrationTenant: any = null;
			try {
				integrationTenant = await this.integrationTenantService.findOneByOptions({
					where: { id: integrationTenantId, tenantId },
					relations: ['settings']
				});
			} catch (error) {
				if (!(error instanceof NotFoundException)) {
					throw error;
				}
			}

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
			let integration: any = null;
			try {
				integration = await this.integrationService.findOneByOptions({
					where: { provider: IntegrationEnum.ACTIVE_PIECES }
				});
			} catch (error) {
				if (!(error instanceof NotFoundException)) {
					throw error;
				}
			}

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
