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

	@Get('/refresh-token/:integrationId')
	refreshHubstaffToken(
		@Param('integrationId') integrationId: string
	): Promise<string> {
		return this._hubstaffService.refreshToken(integrationId);
	}

	@Post('/add-integration')
	addIntegration(@Body() body): Promise<IIntegration> {
		return this._hubstaffService.addIntegration(body);
	}

	@Post('/organizations/:integrationId')
	async getOrganizations(
		@Param('integrationId') integrationId: string,
		@Body() body
	): Promise<IHubstaffOrganization[]> {
		const { organizations } = await this._hubstaffService.fetchIntegration(
			'https://api.hubstaff.com/v2/organizations',
			body.token
		);
		return organizations;
	}

	@Post('/projects/:organizationId')
	async getProjects(
		@Param('organizationId') organizationId: string,
		@Body() { token, integrationId }
	): Promise<IHubstaffProject[]> {
		const { projects } = await this._hubstaffService.fetchIntegration(
			`https://api.hubstaff.com/v2/organizations/${organizationId}/projects?status=all`,
			token
		);
		return projects;
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

	@Post('/sync-organizations/:integrationId')
	async syncOrganizations(
		@Param('integrationId') integrationId: string,
		@Body() body
	): Promise<IIntegrationMap[]> {
		return await this._hubstaffService.syncOrganizations({
			integrationId,
			...body
		});
	}

	@Post('/auto-sync/:integrationId')
	async autoSync(
		@Param('integrationId') integrationId: string,
		@Body() body
	): Promise<any> {
		return await this._hubstaffService.autoSync({
			integrationId,
			...body
		});
	}
}
