import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IIntegrationKeySecretPairInput, IIntegrationTenant, IntegrationEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { IntegrationTenantUpdateOrCreateCommand } from '../../integration-tenant/commands';
import { IntegrationService } from './../../integration/integration.service';

@Injectable()
export class IntegrationAIService {
	private readonly logger = new Logger('IntegrationAIService');

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationService: IntegrationService
	) { }

	/**
	 *
	 *
	 * @param input
	 * @returns
	 */
	async create(
		input: IIntegrationKeySecretPairInput
	): Promise<IIntegrationTenant> {

		try {
			const tenantId = RequestContext.currentTenantId();
			const { client_id, client_secret, organizationId } = input;

			const integration = await this._integrationService.findOneByOptions({
				where: {
					provider: IntegrationEnum.GAUZY_AI
				}
			});

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
						entitySettings: [],
						settings: [
							{
								settingsName: 'apiKey',
								settingsValue: client_id
							},
							{
								settingsName: 'apiSecret',
								settingsValue: client_secret
							}
						].map((setting) => ({
							...setting,
							tenantId,
							organizationId,
						}))
					}
				)
			);
		} catch (error) {
			this.logger.error(`Error while creating ${IntegrationEnum.GAUZY_AI} integration settings`, error?.message);
			throw new Error(`Failed to add ${IntegrationEnum.GAUZY_AI} integration`);
		}
	}
}
