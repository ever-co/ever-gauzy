import { Controller, Post, Body, UseGuards, HttpException, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, RequestContext, TenantPermissionGuard, UseValidationPipe } from '@gauzy/core';
import { GithubService } from './github.service';
import { GithubOAuthStateService } from './github-oauth-state.service';
import { GithubAppInstallDTO, GithubInstallStateDTO, GithubOAuthDTO } from './dto';

@ApiTags('GitHub Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration/github')
export class GitHubController {
	constructor(
		private readonly _githubService: GithubService,
		private readonly _githubOAuthStateService: GithubOAuthStateService
	) {}

	/**
	 * Mint a single-use, tenant-bound state nonce used to start a GitHub App installation.
	 *
	 * The nonce is handed to GitHub as the `state` query param and echoed back on the post-install
	 * callback, so the resulting installation is bound to the tenant/organization that actually
	 * initiated the flow — closing the cross-tenant installation hijack (GHSA-4rwq-65wh-45h4).
	 *
	 * @param input The tenant/organization initiating the installation.
	 * @returns The opaque `state` nonce to pass to GitHub.
	 */
	@Post('/install/state')
	@HttpCode(HttpStatus.CREATED)
	@UseValidationPipe()
	async createInstallationState(@Body() input: GithubInstallStateDTO): Promise<{ state: string }> {
		const tenantId = RequestContext.currentTenantId() || input.tenantId;
		const organizationId = input.organizationId;
		if (!tenantId || !organizationId) {
			throw new HttpException('Invalid tenant or organization', HttpStatus.BAD_REQUEST);
		}
		const state = await this._githubOAuthStateService.create({
			tenantId,
			organizationId,
			userId: RequestContext.currentUserId()
		});
		return { state };
	}

	/**
	 *
	 * @param body
	 * @returns
	 */
	@Post('/install')
	@HttpCode(HttpStatus.CREATED)
	@UseValidationPipe()
	async addGithubAppInstallation(@Body() input: GithubAppInstallDTO) {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!input || !input.installation_id || !input.setup_action || !input.state) {
				throw new HttpException('Invalid github input data', HttpStatus.BAD_REQUEST);
			}
			// Resolve and invalidate the single-use state nonce minted when this flow was initiated.
			// The installation is bound to the tenant/organization recorded against the nonce — NOT to
			// client-supplied identifiers — which closes the cross-tenant IDOR (GHSA-4rwq-65wh-45h4).
			const stateData = await this._githubOAuthStateService.consume(input.state);
			if (!stateData) {
				throw new HttpException(
					'Invalid or expired GitHub installation state. Please restart the GitHub App connection.',
					HttpStatus.BAD_REQUEST
				);
			}
			// Defense in depth: the authenticated caller must be the tenant that initiated the flow.
			const currentTenantId = RequestContext.currentTenantId();
			if (currentTenantId && String(stateData.tenantId) !== String(currentTenantId)) {
				throw new HttpException(
					'GitHub installation state does not belong to the current tenant.',
					HttpStatus.FORBIDDEN
				);
			}
			// Add the GitHub installation using the service, bound to the nonce's tenant/organization.
			return await this._githubService.addGithubAppInstallation({
				installation_id: input.installation_id,
				setup_action: input.setup_action,
				tenantId: stateData.tenantId,
				organizationId: stateData.organizationId
			});
		} catch (error) {
			// Preserve intentional HTTP exceptions (e.g. the cross-tenant uniqueness 400) instead of
			// masking them as a generic 500.
			if (error instanceof HttpException) {
				throw error;
			}
			// Handle errors and return an appropriate error response
			throw new HttpException(
				`Failed to add GitHub integration: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 *
	 * @param body
	 * @returns
	 */
	@Post('/oauth')
	@HttpCode(HttpStatus.CREATED)
	@UseValidationPipe()
	async oAuthEndpointAuthorization(@Body() input: GithubOAuthDTO) {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!input || !input.code) {
				throw new HttpException('Invalid input data', HttpStatus.BAD_REQUEST);
			}
			// Add the GitHub installation using the service
			return await this._githubService.oAuthEndpointAuthorization(input);
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(
				`Failed to add GitHub integration: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
