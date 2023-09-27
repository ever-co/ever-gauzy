import { Controller, Post, Body, UseGuards, HttpException, HttpStatus, HttpCode, UsePipes, ValidationPipe } from '@nestjs/common';
import { IGithubAppInstallInput, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from 'shared/guards';
import { Permissions } from 'shared/decorators';
import { GithubService } from './github.service';
import { GithubAppInstallDTO } from './dto';

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
	@Post('/install')
	@HttpCode(HttpStatus.CREATED)
	@UsePipes(new ValidationPipe())
	async addGithubAppInstallation(
		@Body() input: GithubAppInstallDTO
	) {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!input || !input.installation_id || !input.setup_action) {
				throw new HttpException('Invalid input data', HttpStatus.BAD_REQUEST);
			}

			// Add the GitHub installation using the service
			return await this._githubService.addGithubAppInstallation(input);
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Failed to add GitHub integration: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 *
	 * @param body
	 * @returns
	 */
	@Post('/oauth')
	@HttpCode(HttpStatus.CREATED)
	// ToDo - Create Class Validation DTO to validate request
	async oAuthEndpointAuthorization(@Body() input: IGithubAppInstallInput) {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!input || !input.code) {
				throw new HttpException('Invalid input data', HttpStatus.BAD_REQUEST);
			}
			return await this._githubService.oAuthEndpointAuthorization(input);
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Failed to add GitHub integration: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}
}
