import { Controller, Get, HttpException, HttpStatus, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { IGithubIntegrationConfig, Public } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
import { IGithubAppInstallInput } from '@gauzy/contracts';
import { GithubOAuthStateService } from './github-oauth-state.service';
import { signGithubInstallCode } from './github-install-code-binding';

@Controller('/integration/github')
export class GitHubAuthorizationController {
	constructor(
		private readonly _config: ConfigService,
		private readonly _githubOAuthStateService: GithubOAuthStateService
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
			// The OAuth code proves which GitHub user completed the installation. It is exchanged inside
			// the authenticated POST /install rather than here, so the proof is tied to the Gauzy session
			// that binds the installation, not just to a nonce (GHSA-4rwq-65wh-45h4). Codes are single-use
			// and expire in minutes.
			if (typeof query.code === 'string' && query.code) {
				urlParams.append('code', query.code);
				// Signed with the nonce it arrived with: POST /install accepts the code only in this flow.
				urlParams.append('code_binding', signGithubInstallCode(query.state, query.code));
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
