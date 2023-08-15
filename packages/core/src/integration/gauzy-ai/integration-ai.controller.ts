import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IIntegrationKeySecretPairInput, IIntegrationTenant } from '@gauzy/contracts';
import { GauzyAIIntegrationService } from './integration-ai.service';

@ApiTags('Integrations')
@Controller()
export class GauzyAIIntegrationController {

	constructor(
		private readonly _gauzyAIIntegrationService: GauzyAIIntegrationService
	) { }

	/**
	 *
	 * @param input
	 * @returns
	 */
	@Post()
	async create(
		@Body() input: IIntegrationKeySecretPairInput
	): Promise<IIntegrationTenant> {
		return await this._gauzyAIIntegrationService.create(input);
	}
}
