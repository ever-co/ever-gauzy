import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IIntegrationAICreateInput, IIntegrationTenant, IntegrationEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { RequestContext } from '../../core/context';
import { IntegrationTenantUpdateOrCreateCommand } from '../../integration-tenant/commands';
import { IntegrationService } from './../../integration/integration.service';
import { DEFAULT_ENTITY_SETTINGS } from './integration-ai-entity-settings';

@Injectable()
export class IntegrationAIService {

	constructor(
		private readonly _commandBus: CommandBus,
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
			const tenantId = RequestContext.currentTenantId();
			const organizationId = input.organizationId;

			const { client_id, client_secret, openai_api_secret_key, openai_organization_id } = input;

			/**
			 * Retrieves an integration from the database based on specified options.
			 */
			const integration = await this._integrationService.findOneByOptions({
				where: {
					provider: IntegrationEnum.GAUZY_AI,
					isActive: true,
					isArchived: false
				}
			});

			const entitySettings = DEFAULT_ENTITY_SETTINGS.map((setting) => ({
				...setting,
				organizationId,
				tenantId
			})) || [];

			/** Execute the command to create the integration tenant settings */
			return await this._commandBus.execute(
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
								settingsValue: client_id
							},
							{
								settingsName: 'apiSecret',
								settingsValue: client_secret
							},
							...(isNotEmpty(openai_api_secret_key) ? [
								{
									settingsName: 'openAiApiSecretKey',
									settingsValue: openai_api_secret_key
								}
							] : []),
							...(isNotEmpty(openai_organization_id) ? [
								{
									settingsName: 'openAiOrganizationId',
									settingsValue: openai_organization_id
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
		} catch (error) {
			throw new HttpException(`Failed to add Gauzy AI integration`, HttpStatus.BAD_REQUEST);
		}
	}
}
