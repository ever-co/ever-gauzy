import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IIntegrationKeySecretPairInput, IIntegrationTenant, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { IntegrationAIService } from './integration-ai.service';

@ApiTags('Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller()
export class IntegrationAIController {

	constructor(
		private readonly _integrationAIService: IntegrationAIService
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
		return await this._integrationAIService.create(input);
	}
}
