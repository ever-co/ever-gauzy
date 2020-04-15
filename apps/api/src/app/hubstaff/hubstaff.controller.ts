import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { HubstaffService } from './hubstaff.service';
import {
	IIntegration,
	IHubstaffOrganization,
	IHubstaffProject,
	IIntegrationMap
} from '@gauzy/models';

@Controller()
export class HubstaffController {
	constructor(private _hubstaffService: HubstaffService) {}

	@Get('/get-token/:integrationId')
	getHubstaffToken(
		@Param('integrationId') integrationId: string
	): Promise<string> {
		return this._hubstaffService.getHubstaffToken(integrationId);
	}

	@Post('/add-integration')
	addIntegration(@Body() body): Promise<IIntegration> {
		return this._hubstaffService.addIntegration(body);
	}

	@Post('/organizations/:integrationId')
	async getOrganizations(
		@Param('integrationId') integrationId: string,
		@Body() token
	): Promise<IHubstaffOrganization[]> {
		return await this._hubstaffService.getOrganizations(
			token,
			integrationId
		);
	}

	@Post('/projects/:organizationId')
	async getProjects(
		@Param('organizationId') organizationId: string,
		@Body() { token }
	): Promise<IHubstaffProject[]> {
		return await this._hubstaffService.getProjects(organizationId, token);
	}

	@Post('/sync-projects/:integrationId')
	async syncProjects(
		@Param('integrationId') integrationId: string,
		@Body() body
	): Promise<IIntegrationMap[]> {
		return await this._hubstaffService.syncProjects({
			integrationId,
			...body
		});
	}
}
