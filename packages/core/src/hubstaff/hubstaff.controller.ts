import { Controller, Post, Body, Get, Param, Query, Res } from '@nestjs/common';
import {
	IIntegrationTenant,
	IHubstaffOrganization,
	IHubstaffProject,
	IIntegrationMap,
	IIntegrationSetting
} from '@gauzy/contracts';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@gauzy/config';
import { UUIDValidationPipe } from './../shared/pipes';
import { Public } from './../shared/decorators';
import { HubstaffService } from './hubstaff.service';

@ApiTags('Integrations')
@Controller()
export class HubstaffController {
	constructor(
		private readonly _hubstaffService: HubstaffService,
		private readonly _config: ConfigService
	) {}

	/**
	 * Hubstaff Integration Authorization Flow Callback
	 * 
	 * @param code 
	 * @param state 
	 * @param res 
	 * @returns 
	 */
	@Public()
	@Get('callback')
	async hubstaffIntegrationCallback(
		@Query('code') code: string,
		@Query('state') state: string,
		@Res() res
	) {
		try {
			if (code) {
				return res.redirect(
					`${this._config.get('clientBaseUrl')}/#/pages/integrations/hubstaff?code=${code}&state=${state}`
				);
			}
			return res.redirect(
				`${this._config.get('clientBaseUrl')}/#/pages/integrations/hubstaff`
			);
		} catch (error) {
			return res.redirect(
				`${this._config.get('clientBaseUrl')}/#/pages/integrations/hubstaff`
			);
		}
	}

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
