import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IIntegrationKeySecretPairInput, IIntegrationTenant, IntegrationEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { IntegrationTenantCreateCommand } from '../../integration-tenant/commands';
import { IntegrationService } from './../../integration/integration.service';

@Injectable()
export class IntegrationAIService {

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

		const tenantId = RequestContext.currentTenantId();
		const { client_id, client_secret, organizationId } = input;

		const integration = await this._integrationService.findOneByOptions({
			where: {
				provider: IntegrationEnum.GAUZY_AI
			}
		});

		return await this._commandBus.execute(
			new IntegrationTenantCreateCommand({
				name: IntegrationEnum.GAUZY_AI,
				integration,
				entitySettings: [],
				settings: [
					{
						settingsName: 'apiKey',
						settingsValue: client_id,

					},
					{
						settingsName: 'apiSecret',
						settingsValue: client_secret
					}
				],
				organizationId,
				tenantId,
			})
		);
	}
}
