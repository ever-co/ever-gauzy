import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { HubstaffService } from './hubstaff.service';
import {
	IIntegrationTenant,
	IHubstaffOrganization,
	IHubstaffProject,
	IIntegrationMap,
	IIntegrationSetting
} from '@gauzy/contracts';
import { ApiTags } from '@nestjs/swagger';
import { UUIDValidationPipe } from './../shared/pipes';

@ApiTags('Integrations')
@Controller()
export class HubstaffController {
	constructor(
		private readonly _hubstaffService: HubstaffService
	) {}

	@Get('/token/:integrationId')
	async getHubstaffTokenByIntegration(
		@Param('integrationId', UUIDValidationPipe) integrationId: string
	): Promise<IIntegrationSetting> {
		return await this._hubstaffService.getHubstaffToken(integrationId);
	}

	@Get('/refresh-token/:integrationId')
	async refreshHubstaffTokenByIntegration(
		@Param('integrationId', UUIDValidationPipe) integrationId: string
	): Promise<string> {
		return await this._hubstaffService.refreshToken(integrationId);
	}

	@Post('/integration')
	async addIntegration(
		@Body() body
	): Promise<IIntegrationTenant> {
		return await this._hubstaffService.addIntegration(body);
	}

	@Post('/organizations/:integrationId')
	async getOrganizations(
		@Param('integrationId', UUIDValidationPipe) integrationId: string,
		@Body() body
	): Promise<IHubstaffOrganization[]> {
		return await this._hubstaffService.fetchOrganizations({
			integrationId,
			...body
		});
	}

	@Post('/projects/:organizationId')
	async getProjects(
		@Param('organizationId') organizationId: string,
		@Body() body
	): Promise<IHubstaffProject[]> {
		return await this._hubstaffService.fetchOrganizationProjects({
			organizationId,
			...body
		});
	}

	@Post('/sync-projects/:integrationId')
	async syncProjects(
		@Param('integrationId', UUIDValidationPipe) integrationId: string,
		@Body() body
	): Promise<IIntegrationMap[]> {
		return await this._hubstaffService.syncProjects({
			integrationId,
			...body
		});
	}

	@Post('/sync-organizations/:integrationId')
	async syncOrganizations(
		@Param('integrationId', UUIDValidationPipe) integrationId: string,
		@Body() body
	): Promise<IIntegrationMap[]> {
		return await this._hubstaffService.syncOrganizations({
			integrationId,
			...body
		});
	}

	@Post('/auto-sync/:integrationId')
	async autoSync(
		@Param('integrationId', UUIDValidationPipe) integrationId: string,
		@Body() body
	): Promise<any> {
		return await this._hubstaffService.autoSync({
			integrationId,
			...body
		});
	}
}
