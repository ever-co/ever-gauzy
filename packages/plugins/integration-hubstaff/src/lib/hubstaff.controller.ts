import { Controller, Post, Body, Get, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
	IIntegrationTenant,
	IHubstaffOrganization,
	IHubstaffProject,
	IIntegrationMap,
	IIntegrationSetting,
	PermissionsEnum,
	ICreateHubstaffIntegrationInput,
	ID
} from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { HubstaffService } from './hubstaff.service';

@ApiTags('Hubstaff Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller('/integration/hubstaff')
export class HubstaffController {
	constructor(private readonly _hubstaffService: HubstaffService) {}

	/**
	 * Get Hubstaff token by integration ID
	 *
	 * @param integrationId The ID of the integration
	 * @returns Integration setting containing the Hubstaff token
	 */
	@Get('/token/:integrationId')
	async getHubstaffTokenByIntegration(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID
	): Promise<IIntegrationSetting> {
		return await this._hubstaffService.getHubstaffToken(integrationId);
	}

	/**
	 * Refresh Hubstaff token by integration ID
	 *
	 * @param integrationId The ID of the integration
	 * @returns The refreshed Hubstaff token
	 */
	@Get('/refresh-token/:integrationId')
	async refreshHubstaffTokenByIntegration(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID
	): Promise<string> {
		return await this._hubstaffService.refreshToken(integrationId);
	}

	/**
	 * Create a new Hubstaff integration
	 *
	 * @param body The input data for creating the integration
	 * @returns The created integration tenant
	 */
	@Post('/integration')
	async create(@Body() body: ICreateHubstaffIntegrationInput): Promise<IIntegrationTenant> {
		return await this._hubstaffService.addIntegration(body);
	}

	/**
	 * Get organizations from Hubstaff
	 *
	 * @param token The authentication token
	 * @returns List of Hubstaff organizations
	 */
	@Get('/organizations')
	async getOrganizations(@Query('token') token: string): Promise<IHubstaffOrganization[]> {
		return await this._hubstaffService.fetchOrganizations(token);
	}

	/**
	 * Get projects for a specific organization from Hubstaff
	 *
	 * @param organizationId The ID of the organization
	 * @param token The authentication token
	 * @returns List of projects for the organization
	 */
	@Get('/projects/:organizationId')
	async getProjects(
		@Param('organizationId') organizationId: ID,
		@Query('token') token: string
	): Promise<IHubstaffProject[]> {
		return await this._hubstaffService.fetchOrganizationProjects({
			token,
			organizationId
		});
	}

	/**
	 * Sync projects data with Hubstaff
	 *
	 * @param input The input data for syncing projects
	 * @returns List of integration maps after syncing
	 */
	@Post('/sync-projects')
	async syncProjects(@Body() input: any): Promise<IIntegrationMap[]> {
		return await this._hubstaffService.syncProjects(input);
	}

	/**
	 * Sync organizations data with Hubstaff
	 *
	 * @param input The input data for syncing organizations
	 * @returns List of integration maps after syncing
	 */
	@Post('/sync-organizations')
	async syncOrganizations(@Body() input: any): Promise<IIntegrationMap[]> {
		return await this._hubstaffService.syncOrganizations(input);
	}

	/**
	 * Automatically sync data for an integration with Hubstaff
	 *
	 * @param integrationId The ID of the integration
	 * @param body The input data for auto-sync
	 * @returns Result of the auto-sync operation
	 */
	@Post('/auto-sync/:integrationId')
	async autoSync(@Param('integrationId', UUIDValidationPipe) integrationId: ID, @Body() body): Promise<any> {
		return await this._hubstaffService.autoSync({
			...body,
			integrationId
		});
	}
}
