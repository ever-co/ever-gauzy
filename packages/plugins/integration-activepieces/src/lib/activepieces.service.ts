import { Injectable, BadRequestException, NotFoundException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@gauzy/config';
import { firstValueFrom, catchError } from 'rxjs';
import { AxiosError } from 'axios';
import { IntegrationEnum } from '@gauzy/contracts';
import { IntegrationSettingService, IntegrationService, IntegrationTenantService, RequestContext } from '@gauzy/core';
import {
	IActivepiecesConnection,
	IActivepiecesConnectionRequest,
	ActivepiecesSettingName,
	ActivepiecesConnectionType,
	ICreateActivepiecesIntegrationInput
} from './activepieces.type';
import { ACTIVEPIECES_CONNECTIONS_URL } from './activepieces.config';

@Injectable()
export class ActivepiecesService {
	private readonly logger = new Logger(ActivepiecesService.name);

	constructor(
		private readonly httpService: HttpService,
		private readonly configService: ConfigService,
		private readonly integrationSettingService: IntegrationSettingService,
		private readonly integrationService: IntegrationService,
		private readonly integrationTenantService: IntegrationTenantService
	) {}

	/**
	 * Create a new ActivePieces connection for the tenant
	 */
	async createConnection(input: ICreateActivepiecesIntegrationInput): Promise<IActivepiecesConnection> {
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

			// Prepare the connection request for ActivePieces
			const connectionRequest: IActivepiecesConnectionRequest = {
				externalId,
				displayName,
				pieceName: 'Ever-gauzy', // Your piece name in ActivePieces
				projectId: input.projectId,
				metadata: {
					tenantId,
					organizationId,
					createdAt: new Date().toISOString()
				},
				type: ActivepiecesConnectionType.OAUTH2,
				value: {
					type: ActivepiecesConnectionType.OAUTH2,
					client_id: clientId,
					client_secret: clientSecret,
					data: {
						tenantId,
						organizationId
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
						catchError((error: AxiosError) => {
							this.logger.error('Error creating ActivePieces connection:', error.response?.data);
							throw new HttpException(
								`Failed to create ActivePieces connection: ${error.message}`,
								error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
							);
						})
					)
			);

			// Save the connection details to the database
			await this.saveConnectionSettings(response.data, input.accessToken, tenantId, organizationId);

			this.logger.log(`Successfully created ActivePieces connection: ${response.data.id}`);
			return response.data;
		} catch (error: any) {
			this.logger.error('Failed to create ActivePieces connection:', error);
			throw new BadRequestException(`Failed to create connection: ${error.message}`);
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
			return null;
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
			return false;
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
				throw new NotFoundException('Access token not found for this integration');
			}

			return tokenSetting.settingsValue;
		} catch (error: any) {
			this.logger.error('Failed to get valid access token:', error);
			throw new BadRequestException(`Failed to get valid access token: ${error.message}`);
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

			return enabledSetting?.settingsValue === 'true';
		} catch (error) {
			this.logger.error('Error checking if integration is enabled:', error);
			return false;
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
	): Promise<void> {
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
					settingsValue: connection.projectId,
					tenantId,
					organizationId
				},
				{
					settingsName: ActivepiecesSettingName.IS_ENABLED,
					settingsValue: 'true',
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

			this.logger.log(`Successfully saved ActivePieces connection settings for tenant ${tenantId}`);
		} catch (error: any) {
			this.logger.error('Failed to save ActivePieces connection settings:', error);
			throw new BadRequestException(`Failed to save connection settings: ${error.message}`);
		}
	}
}
