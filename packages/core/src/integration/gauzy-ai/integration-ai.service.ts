import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IIntegrationKeySecretPairInput, IIntegrationTenant, IntegrationEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { IntegrationTenantCreateCommand } from '../../integration-tenant/commands';

@Injectable()
export class GauzyAIIntegrationService {

	constructor(
		private readonly _commandBus: CommandBus
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

		return await this._commandBus.execute(
			new IntegrationTenantCreateCommand({
				organizationId,
				name: IntegrationEnum.GAUZY_AI,
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
					organizationId,
					tenantId
				}))
			})
		);
	}
}
