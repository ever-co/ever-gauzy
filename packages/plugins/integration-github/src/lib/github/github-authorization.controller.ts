import { Controller, Get, HttpException, HttpStatus, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { IGithubIntegrationConfig, Public } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
import { IGithubAppInstallInput } from '@gauzy/contracts';
import { GithubOAuthStateService } from './github-oauth-state.service';
import { signGithubInstallProof } from './github-install-proof';
import { GithubInstallationOwnershipService } from './github-installation-ownership.service';
import { GITHUB_INSTALLATION_ID_PATTERN } from './dto/github-app-install.dto';

@Controller('/integration/github')
export class GitHubAuthorizationController {
	private readonly logger = new Logger(GitHubAuthorizationController.name);

	constructor(
		private readonly _config: ConfigService,
		private readonly _githubOAuthStateService: GithubOAuthStateService,
		private readonly _ownership: GithubInstallationOwnershipService
	) {}

	/**
	 * Public post-install callback hit by GitHub after a user installs the GitHub App.
	 *
	 * @param query
	 * @param response
	 */
	@Public()
	@Get('/callback')
	async githubIntegrationPostInstallCallback(@Query() query: IGithubAppInstallInput, @Res() response: Response) {
		try {
			/** Github Config Options */
			const { postInstallUrl } = this._config.get('github') as IGithubIntegrationConfig;

			// Editing an installation on GitHub (setup_action=update) redirects here without the state
			// nonce Gauzy only mints for new connections. Nothing can be bound without it, so send the
			// user back to the app instead of answering with a raw 400 page.
			if (query && !query.state && query.setup_action === 'update') {
				return response.redirect(`${postInstallUrl}?setup_action=update`);
			}

			// A member ASKED an owner to install the App (setup_action=request): there is no installation
			// yet, so nothing can be bound. Send them back to the app to see that, rather than a raw 400.
			if (query && query.setup_action === 'request') {
				return response.redirect(`${postInstallUrl}?setup_action=request`);
			}

			// Validate the input data (You can use class-validator for validation)
			if (!query || !query.installation_id || !query.setup_action || !query.state) {
				throw new HttpException('Invalid github callback query data', HttpStatus.BAD_REQUEST);
			}

			// Validate the state nonce minted when the install flow was initiated. We only PEEK here
			// (the nonce is consumed when the installation is finalized), but rejecting an unknown
			// nonce blocks forged callbacks. It also lets us ALWAYS redirect to the server-side
			// post-install URL rather than to a client-supplied value (closes the open redirect).
			const stateData = await this._githubOAuthStateService.peek(query.state);
			if (!stateData) {
				throw new HttpException('Invalid or expired GitHub installation state.', HttpStatus.BAD_REQUEST);
			}

			/** Construct the redirect URL with query parameters. */
			const urlParams = new URLSearchParams();
			urlParams.append('installation_id', query.installation_id);
			urlParams.append('setup_action', query.setup_action);
			urlParams.append('state', query.state);
			// Prove that the GitHub user who completed this flow is entitled to the whole installation
			// (GHSA-4rwq-65wh-45h4). GitHub sends `code` only when the App requests user authorization
			// during installation. It is exchanged HERE, the moment it arrives, so it is spent and cannot
			// be replayed from a URL or a log; the browser receives only a signed, short-lived proof bound
			// to this flow's nonce, and POST /install binds nothing without it. When there is no proof,
			// `install_check` says why, so the web app can show the right message.
			const installationId = String(query.installation_id);
			let installCheck: 'no_code' | 'not_entitled' | 'unverifiable' = 'no_code';
			let installProof: string | undefined;
			if (typeof query.code === 'string' && query.code && GITHUB_INSTALLATION_ID_PATTERN.test(installationId)) {
				try {
					if (await this._ownership.isEntitledToInstallation(query.code, installationId)) {
						installProof = signGithubInstallProof(query.state, installationId);
					} else {
						installCheck = 'not_entitled';
					}
				} catch (error) {
					installCheck = 'unverifiable';
					this.logger.error(`GitHub installation ownership check failed: ${(error as Error)?.message}`);
				}
			}
			if (installProof) {
				urlParams.append('install_proof', installProof);
			} else {
				urlParams.append('install_check', installCheck);
			}

			/**
			 * Always redirect to the server-side configured post-install URL — never to a
			 * client-supplied `state` value (anti open-redirect, GHSA-4rwq-65wh-45h4).
			 */
			return response.redirect(`${postInstallUrl}?${urlParams.toString()}`);
		} catch (error) {
			// Preserve intentional HTTP exceptions instead of masking them as a generic 500.
			if (error instanceof HttpException) {
				throw error;
			}
			// Handle errors and return an appropriate error response
			throw new HttpException(
				`Failed to add GitHub installation: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
