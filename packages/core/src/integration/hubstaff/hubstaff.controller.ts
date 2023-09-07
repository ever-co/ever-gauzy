import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import {
	IIntegrationTenant,
	IHubstaffOrganization,
	IHubstaffProject,
	IIntegrationMap,
	IIntegrationSetting,
	PermissionsEnum,
	ICreateHubstaffIntegrationInput,
	IOrganization
} from '@gauzy/contracts';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from 'shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from 'shared/guards';
import { UUIDValidationPipe } from 'shared/pipes';
import { HubstaffService } from './hubstaff.service';

@ApiTags('Hubstaff Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller()
export class HubstaffController {
	constructor(
		private readonly _hubstaffService: HubstaffService,
	) { }

	/**
	 *
	 *
	 * @param integrationId
	 * @returns
	 */
	@Get('/token/:integrationId')
	async getHubstaffTokenByIntegration(
		@Param('integrationId', UUIDValidationPipe) integrationId: IIntegrationTenant['id']
	): Promise<IIntegrationSetting> {
		return await this._hubstaffService.getHubstaffToken(integrationId);
	}

	/**
	 *
	 * @param integrationId
	 * @returns
	 */
	@Get('/refresh-token/:integrationId')
	async refreshHubstaffTokenByIntegration(
		@Param('integrationId', UUIDValidationPipe) integrationId: IIntegrationTenant['id']
	): Promise<string> {
		return await this._hubstaffService.refreshToken(integrationId);
	}

	/**
	 *
	 * @param body
	 * @returns
	 */
	@Post('/integration')
	async create(
		@Body() body: ICreateHubstaffIntegrationInput
	): Promise<IIntegrationTenant> {
		return await this._hubstaffService.addIntegration(body);
	}

	/**
	 *
	 * @param integrationId
	 * @param body
	 * @returns
	 */
	@Post('/organizations/:integrationId')
	async getOrganizations(
		@Param('integrationId', UUIDValidationPipe) integrationId: IIntegrationTenant['id'],
		@Body() body
	): Promise<IHubstaffOrganization[]> {
		return await this._hubstaffService.fetchOrganizations({
			...body
		});
	}

	/**
	 *
	 * @param organizationId
	 * @param body
	 * @returns
	 */
	@Post('/projects/:organizationId')
	async getProjects(
		@Param('organizationId') organizationId: IOrganization['id'],
		@Body() body
	): Promise<IHubstaffProject[]> {
		return await this._hubstaffService.fetchOrganizationProjects({
			...body,
			organizationId
		});
	}

	/**
	 *
	 * @param integrationId
	 * @param body
	 * @returns
	 */
	@Post('/sync-projects/:integrationId')
	async syncProjects(
		@Param('integrationId', UUIDValidationPipe) integrationId: IIntegrationTenant['id'],
		@Body() body
	): Promise<IIntegrationMap[]> {
		return await this._hubstaffService.syncProjects({
			...body,
			integrationId
		});
	}

	/**
	 *
	 * @param integrationId
	 * @param body
	 * @returns
	 */
	@Post('/sync-organizations/:integrationId')
	async syncOrganizations(
		@Param('integrationId', UUIDValidationPipe) integrationId: string,
		@Body() body
	): Promise<IIntegrationMap[]> {
		return await this._hubstaffService.syncOrganizations({
			...body,
			integrationId
		});
	}

	/**
	 *
	 * @param integrationId
	 * @param body
	 * @returns
	 */
	@Post('/auto-sync/:integrationId')
	async autoSync(
		@Param('integrationId', UUIDValidationPipe) integrationId: string,
		@Body() body
	): Promise<any> {
		return await this._hubstaffService.autoSync({
			...body,
			integrationId
		});
	}
}
