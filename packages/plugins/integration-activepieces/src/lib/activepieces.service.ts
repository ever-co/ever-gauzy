import {
	Injectable,
	BadRequestException,
	ForbiddenException,
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
import { IsNull } from 'typeorm';
import { IntegrationEnum } from '@gauzy/contracts';
import { IntegrationService, IntegrationSettingService, IntegrationTenantService, RequestContext } from '@gauzy/core';
import {
	IActivepiecesConnection,
	IActivepiecesConnectionRequest,
	IActivepiecesConnectionsListResponse,
	IActivepiecesConnectionsListParams,
	IActivepiecesConnectionModeStatus,
	ActivepiecesConnectionMode,
	ActivepiecesSettingName,
	ActivepiecesConnectionType,
	ActivepiecesConnectionScope,
	ICreateActivepiecesIntegrationInput,
	IActivepiecesErrorResponse
} from '@gauzy/contracts';
import { ACTIVEPIECES_CONNECTIONS_URL, ACTIVEPIECES_PIECE_NAME } from './activepieces.config';
import { ActivepiecesCredentialsService, IActivepiecesCredential } from './activepieces-credentials.service';

/**
 * The query of a connection list. `projectId` is optional: in the modes that pin the tenant's own project, the server
 * names it; with the tenant's own key, the client must.
 */
export type ActivepiecesConnectionsListInput = Omit<IActivepiecesConnectionsListParams, 'projectId'> & {
	projectId?: string;
};

/** The Activepieces URL of one app connection. */
function connectionUrl(connectionId: string): string {
	return `${ACTIVEPIECES_CONNECTIONS_URL}/${encodeURIComponent(connectionId)}`;
}

@Injectable()
export class ActivepiecesService {
	private readonly logger = new Logger(ActivepiecesService.name);

	constructor(
		private readonly httpService: HttpService,
		private readonly configService: ConfigService,
		private readonly integrationService: IntegrationService,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly integrationSettingService: IntegrationSettingService,
		private readonly credentials: ActivepiecesCredentialsService
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
			const existingTenant = await this.findExistingIntegrationTenant(tenantId, organizationId);

			let integrationTenantId: string;

			if (existingTenant?.id) {
				// Update existing tenant's settings by merging/replacing API_KEY and IS_ENABLED
				await this.saveMergedSettings(existingTenant, settings);

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

			// The credential of the row the connection is saved on, so creating, reading and deleting the connection use
			// the same one. When that row holds no key, the key of any tenant row; otherwise the tenant's own project
			// (project token, or the installation's key pinned to that project). Never the installation's key unconfined.
			const scopedIntegrationTenant = await this.findExistingIntegrationTenant(tenantId, organizationId, true);
			const credential = await this.credentials.resolve({
				integrationTenantId: scopedIntegrationTenant?.id,
				organizationId
			});
			// In the modes that pin the tenant's project, the server names it, and another one sent is refused
			const projectId = this.credentials.projectFor(credential, input.projectId);

			// Prepare the connection request for ActivePieces (upsert format with SECRET_TEXT)
			const connectionRequest: IActivepiecesConnectionRequest = {
				externalId,
				displayName,
				pieceName: ACTIVEPIECES_PIECE_NAME,
				projectId,
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

			if (!scopedIntegrationTenant) {
				this.logger.log(
					`No Activepieces integration row for tenant ${tenantId} in this scope yet: ` +
						`the connection is created in mode ${credential.mode}.`
				);
			}

			// Make the API call to create the connection
			const response = await firstValueFrom(
				this.httpService
					.post<IActivepiecesConnection>(ACTIVEPIECES_CONNECTIONS_URL, connectionRequest, {
						headers: {
							Authorization: `Bearer ${credential.token}`,
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
				organizationId,
				scopedIntegrationTenant
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
		params: ActivepiecesConnectionsListInput,
		integrationId?: string
	): Promise<IActivepiecesConnectionsListResponse> {
		try {
			// We need an integration ID to get the access token
			if (!integrationId) {
				throw new BadRequestException('Integration ID is required to list connections');
			}
			const credential = await this.credentials.resolve({ integrationTenantId: integrationId });
			// In the modes that pin the tenant's project, the server names it, and another one sent is refused
			const projectId = this.credentials.projectFor(credential, params.projectId);

			// Build query parameters
			const queryParams = new URLSearchParams();
			queryParams.append('projectId', projectId);

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
								Authorization: `Bearer ${credential.token}`,
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

			// Belt and braces: in the modes that pin the tenant's project, nothing of another project is returned
			if (credential.enforceProject) {
				return {
					...response.data,
					data: (response.data?.data ?? []).filter((connection) =>
						this.credentials.isInProject(credential, connection?.projectIds)
					)
				};
			}
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

			const credential = await this.credentials.resolve({ integrationTenantId });
			const connection = await this.fetchConnection(connectionIdSetting.settingsValue, credential);

			// Under the installation's key, Activepieces answers a connection by id from whichever project of the
			// platform it is in: it is returned only when it is in the tenant's own project
			this.credentials.assertInProject(credential, connection?.projectIds, 'Activepieces connection');

			return connection;
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

			const credential = await this.credentials.resolve({ integrationTenantId });

			// Under the installation's key, Activepieces deletes a connection by id in whichever project of the platform
			// it is in: it is first checked to be in the tenant's own project
			if (credential.enforceProject) {
				const connection = await this.fetchConnection(connectionIdSetting.settingsValue, credential);
				this.credentials.assertInProject(credential, connection?.projectIds, 'Activepieces connection');
			}

			await firstValueFrom(
				this.httpService
					.delete(connectionUrl(connectionIdSetting.settingsValue), {
						headers: {
							Authorization: `Bearer ${credential.token}`,
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
	 *
	 * The tenant's own key, or its project token. It used to fall back to the installation's key
	 * (`GAUZY_ACTIVEPIECES_API_KEY`), which reaches every project of the operator's Activepieces platform, so a tenant
	 * without a key of its own acted on any other tenant's projects. The installation's key is never handed out for a
	 * tenant: a caller that may run under it uses {@link resolveCredential}, and names the credential's project.
	 *
	 * @param integrationTenantId - The integration tenant ID (not the base integration ID)
	 * @throws ForbiddenException when the tenant's requests run under the installation's key.
	 */
	async getApiKey(integrationTenantId?: string): Promise<string> {
		const credential = await this.resolveCredential(integrationTenantId);
		if (credential.mode === ActivepiecesConnectionMode.PLATFORM_PROJECT) {
			throw new ForbiddenException(
				"This tenant reaches Activepieces through the installation's key, confined to its own project: the key itself is never handed out."
			);
		}
		return credential.token;
	}

	/**
	 * The credential of the current tenant's request, with the project it is confined to, if any.
	 *
	 * @param integrationTenantId - The integration tenant the request is about, if any.
	 */
	async resolveCredential(integrationTenantId?: string): Promise<IActivepiecesCredential> {
		try {
			return await this.credentials.resolve({ integrationTenantId });
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
	 * How the current tenant reaches Activepieces: the mode it chose, the mode in use, the modes available, its
	 * project. Never a secret.
	 */
	async getConnectionModeStatus(organizationId?: string): Promise<IActivepiecesConnectionModeStatus> {
		return this.credentials.describe(organizationId);
	}

	/**
	 * Saves how the current tenant reaches Activepieces.
	 */
	async setConnectionMode(
		mode: ActivepiecesConnectionMode,
		organizationId?: string
	): Promise<IActivepiecesConnectionModeStatus> {
		return this.credentials.setMode(mode, organizationId);
	}

	/**
	 * Connects the current tenant's own Activepieces project now (project-token and platform-project modes), instead of
	 * at its first call, and answers its id. With the tenant's own key there is no project to connect: the tenant
	 * names its projects.
	 */
	async connectTenantProject(
		organizationId?: string
	): Promise<{ mode: IActivepiecesCredential['mode']; projectId: string | null }> {
		const credential = await this.credentials.resolve({ organizationId });
		return { mode: credential.mode, projectId: credential.projectId };
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
	 * Save connection settings to the database, on the integration tenant of the connection's scope when one exists
	 */
	private async saveConnectionSettings(
		connection: IActivepiecesConnection,
		accessToken: string,
		tenantId: string,
		organizationId?: string,
		existingTenant?: any
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

			// Reuse the integration tenant created by setupIntegration for the same scope so the connection keeps its API key
			let integrationTenant: any;

			if (existingTenant?.id) {
				await this.saveMergedSettings(existingTenant, settings);
				integrationTenant = existingTenant;
			} else {
				integrationTenant = await this.integrationTenantService.create({
					name: IntegrationEnum.ACTIVE_PIECES,
					integration,
					tenantId,
					organizationId,
					settings
				});
			}

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

	/**
	 * Find the ActivePieces integration tenant of the tenant, scoped to the organization when one is given.
	 * With `exactScope`, a call without an organization only matches the tenant-level row (organizationId IS NULL),
	 * so a tenant-level connection never lands on an organization's row.
	 * Connection calls used to add a row without an API key each time, so among matching rows the one holding a key wins.
	 */
	private async findExistingIntegrationTenant(
		tenantId: string,
		organizationId?: string,
		exactScope = false
	): Promise<any> {
		let organizationFilter: Record<string, unknown> = {};
		if (organizationId) {
			organizationFilter = { organizationId };
		} else if (exactScope) {
			organizationFilter = { organizationId: IsNull() };
		}

		const integrationTenants = await this.integrationTenantService.find({
			where: {
				tenantId,
				...organizationFilter,
				integration: { provider: IntegrationEnum.ACTIVE_PIECES }
			},
			relations: ['settings']
		});

		return (
			integrationTenants.find((integrationTenant) => this.hasApiKey(integrationTenant)) ??
			integrationTenants[0] ??
			null
		);
	}

	/**
	 * Whether the integration tenant holds an Activepieces API key.
	 */
	private hasApiKey(integrationTenant: any): boolean {
		return !!this.findApiKey(integrationTenant);
	}

	/**
	 * The Activepieces API key held by the integration tenant, if any.
	 */
	private findApiKey(integrationTenant: any): string | undefined {
		return integrationTenant?.settings?.find(
			(setting: any) => setting.settingsName === ActivepiecesSettingName.API_KEY && setting.settingsValue
		)?.settingsValue;
	}

	/**
	 * Merge settings into an existing integration tenant by settingsName.
	 * Matching rows are updated in place so they keep their database id, missing ones are added to the tenant.
	 * Only the rows of the given settings are written, so a setting saved meanwhile by another call, such as a new
	 * API key, is never written back with the value read here.
	 */
	private async saveMergedSettings(existingTenant: any, settings: any[]): Promise<void> {
		await this.credentials.saveMergedSettings(existingTenant, settings);
	}

	/**
	 * Reads one app connection by id, with the request's credential.
	 */
	private async fetchConnection(connectionId: string, credential: IActivepiecesCredential): Promise<IActivepiecesConnection> {
		const response = await firstValueFrom(
			this.httpService
				.get<IActivepiecesConnection>(connectionUrl(connectionId), {
					headers: {
						Authorization: `Bearer ${credential.token}`,
						'Content-Type': 'application/json'
					}
				})
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
	}
}
