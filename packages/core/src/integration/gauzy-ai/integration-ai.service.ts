import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IIntegrationAICreateInput, IIntegrationTenant, IntegrationEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { GauzyAIService, RequestConfigProvider } from '@gauzy/integration-ai';
import { RequestContext } from '../../core/context';
import { IntegrationTenantUpdateOrCreateCommand } from '../../integration-tenant/commands';
import { IntegrationService } from './../../integration/integration.service';
import { DEFAULT_ENTITY_SETTINGS } from './integration-ai-entity-settings';

@Injectable()
export class IntegrationAIService {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _requestConfigProvider: RequestConfigProvider,
		private readonly _gauzyAIService: GauzyAIService,
		private readonly _integrationService: IntegrationService
	) { }

	/**
 * Creates a new integration tenant for Gauzy AI.
 * @param input - The input data for creating the integration tenant.
 * @returns A promise that resolves to the created integration tenant.
 */
	async create(
		input: IIntegrationAICreateInput
	): Promise<IIntegrationTenant> {
		try {
			// Destructure input data
			const { apiKey, apiSecret, openAiSecretKey, openAiOrganizationId } = input;

			// Get the current tenant and organization IDs
			const tenantId = RequestContext.currentTenantId();
			const organizationId = input.organizationId;

			// Retrieve Gauzy AI integration from the database
			const integration = await this._integrationService.findOneByOptions({
				where: {
					provider: IntegrationEnum.GAUZY_AI,
					isActive: true,
					isArchived: false
				}
			});

			// Generate entity settings for the integration tenant
			const entitySettings = DEFAULT_ENTITY_SETTINGS.map((setting) => ({
				...setting,
				organizationId,
				tenantId
			})) || [];

			// Execute the command to create/update the integration tenant settings
			const createdIntegration: IIntegrationTenant = await this._commandBus.execute(
				new IntegrationTenantUpdateOrCreateCommand(
					{
						name: IntegrationEnum.GAUZY_AI,
						integration: {
							provider: IntegrationEnum.GAUZY_AI
						},
						tenantId,
						organizationId,
					},
					{
						name: IntegrationEnum.GAUZY_AI,
						integration,
						organizationId,
						tenantId,
						entitySettings,
						settings: [
							{
								settingsName: 'apiKey',
								settingsValue: apiKey
							},
							{
								settingsName: 'apiSecret',
								settingsValue: apiSecret
							},
							...(isNotEmpty(openAiSecretKey) ? [
								{
									settingsName: 'openAiSecretKey',
									settingsValue: openAiSecretKey
								}
							] : []),
							...(isNotEmpty(openAiOrganizationId) ? [
								{
									settingsName: 'openAiOrganizationId',
									settingsValue: openAiOrganizationId
								}
							] : []),
						].map((setting) => ({
							...setting,
							tenantId,
							organizationId,
						}))
					}
				)
			);

			// Set configuration in the requestConfigProvider
			this._requestConfigProvider.setConfig({
				apiKey,
				apiSecret,
				...(isNotEmpty(openAiSecretKey) && { openAiSecretKey }),
				...(isNotEmpty(openAiOrganizationId) && { openAiOrganizationId }),
			});

			// Update Gauzy AI service with the new API key
			await this._gauzyAIService.updateOneTenantApiKey({
				apiKey,
				apiSecret,
				openAiSecretKey,
				openAiOrganizationId
			});

			// Reset configuration in the requestConfigProvider
			this._requestConfigProvider.resetConfig();

			// Return the created integration tenant
			return createdIntegration;
		} catch (error) {
			// Handle errors and throw an HTTP exception with a specific message
			throw new HttpException(`Failed to add Gauzy AI integration`, HttpStatus.BAD_REQUEST);
		}
	}
}
