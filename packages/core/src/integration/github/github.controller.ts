import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { IGithubAppInstallInput, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from 'shared/guards';
import { Permissions } from 'shared/decorators';
import { GithubService } from './github.service';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller()
export class GitHubController {
	constructor(
		private readonly _githubService: GithubService
	) { }

	/**
	 *
	 * @param body
	 * @returns
	 */
	@Post('oauth/access_token')
	async create(@Body() input: IGithubAppInstallInput) {
		return await this._githubService.oAuthEndpointAuthorization(input);
	}
}
