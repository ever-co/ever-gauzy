import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IIntegrationAICreateInput, IIntegrationTenant, IIntegrationTenantUpdateInput, IntegrationEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { GauzyAIService, RequestConfigProvider } from '@gauzy/integration-ai';
import { RequestContext } from '../../core/context';
import { arrayToObject } from '../../core/utils';
import { IntegrationTenantUpdateOrCreateCommand } from '../../integration-tenant/commands';
import { IntegrationTenantService } from '../../integration-tenant/integration-tenant.service';
import { IntegrationService } from './../../integration/integration.service';
import { DEFAULT_ENTITY_SETTINGS } from './integration-ai-entity-settings';

@Injectable()
export class IntegrationAIService {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _requestConfigProvider: RequestConfigProvider,
		private readonly _gauzyAIService: GauzyAIService,
		private readonly _integrationService: IntegrationService,
		private readonly _integrationTenantService: IntegrationTenantService
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
			}));

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

			// Calling the updateOneTenantApiKey method with the input object
			await this.updateOneTenantApiKey({
				apiKey,
				apiSecret,
				...(isNotEmpty(openAiSecretKey) && { openAiSecretKey }),
				...(isNotEmpty(openAiOrganizationId) && { openAiOrganizationId }),
			});

			// Return the created integration tenant
			return createdIntegration;
		} catch (error) {
			// Handle errors and throw an HTTP exception with a specific message
			throw new HttpException(`Failed to add Gauzy AI integration`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Updates an integration tenant by ID with the provided input.
	 *
	 * @param {IIntegrationTenant['id']} integrationId - The ID of the integration tenant to update.
	 * @param {IIntegrationTenantUpdateInput} input - The input data for the update.
	 * @returns {Promise<IIntegrationTenant>} - A promise resolving to the updated integration tenant.
	 */
	public async update(
		integrationId: IIntegrationTenant['id'],
		input: IIntegrationTenantUpdateInput
	): Promise<IIntegrationTenant> {
		try {
			// Retrieve Gauzy AI integration from the database
			const integration = await this._integrationTenantService.findOneByIdString(integrationId, {
				relations: {
					settings: true
				}
			});

			// Extract settings from the retrieved integration
			const { apiKey, apiSecret, openAiSecretKey, openAiOrganizationId } = arrayToObject(integration.settings, 'settingsName', 'settingsValue');

			// Check if apiKey exists before calling updateOneTenantApiKey
			if (apiKey) {
				// Calling the updateOneTenantApiKey method with the input object
				await this.updateOneTenantApiKey({
					apiKey,
					apiSecret,
					...(isNotEmpty(openAiSecretKey) && { openAiSecretKey }),
					...(isNotEmpty(openAiOrganizationId) && { openAiOrganizationId }),
				});
			}

			// Return the updated integration
			return integration;
		} catch (error) {
			// If an error occurs, throw a BadRequestException
			throw new BadRequestException(error);
		}
	}

	/**
	 * Updates a tenant's API key by configuring the necessary parameters,
	 * triggering the update in the Gauzy AI service, and handling any potential errors in a robust manner.
	 */
	async updateOneTenantApiKey({
		apiKey,
		apiSecret,
		openAiSecretKey,
		openAiOrganizationId
	}): Promise<void> {
		try {
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
		} catch (error) {
			// Log any errors that occur during the update process
			console.log(`Error while updating Tenant Api Key: %s`, error?.message);
		}
	}
}
