import { Controller, Get, HttpException, HttpStatus, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { Public } from '@gauzy/common';
import { OAuthAppSessionData, SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';

@UseGuards(AuthGuard('auth0'))
@Public()
@Controller('/auth')
export class Auth0Controller {
	constructor(public readonly service: SocialAuthService) {}

	/**
	 * Handles the initial Auth0 login request.
	 *
	 * @param req - The incoming request object, typically used to access request data or user information.
	 */
	@Get('/auth0')
	auth0Login(@Req() _: Request) {}

	/**
	 * Handles the callback from Auth0 after a successful login.
	 *
	 * @param context - The context of the incoming request, including the authenticated user information.
	 * @param res - The response object used to send a redirect or response to the client.
	 * @returns {Promise<void>} - A promise that resolves after redirecting the user.
	 */
	@Get('/auth0/callback')
	async auth0LoginCallback(
		@RequestCtx() context: IIncomingRequest,
		@Req() req: Request,
		@Res() res: Response
	): Promise<any> {
		const { user } = context;

		const session = (req as any).session;
		const oauthRequest = session?.oauthApp as OAuthAppSessionData | undefined;

		if (oauthRequest) {
			// Regenerate the session to prevent session fixation and clear OAuth
			// state atomically. The old session (including oauthApp) is destroyed
			// and a new session ID is issued. We already captured oauthRequest above.
			try {
				await new Promise<void>((resolve, reject) => {
					session.regenerate((err: any) => (err ? reject(err) : resolve()));
				});
			} catch {
				throw new HttpException('Failed to initialize secure session', HttpStatus.INTERNAL_SERVER_ERROR);
			}

			// Re-validate redirect_uri against the allowlist (defense-in-depth against session tampering)
			if (!this.service.isOAuthAppRedirectUriAllowed(oauthRequest.redirectUri)) {
				throw new HttpException('Invalid redirect_uri', HttpStatus.BAD_REQUEST);
			}

			try {
				const oauthUser = await this.service.getOAuthLoginUser(user.emails);
				if (!oauthUser) {
					const errorParams = new URLSearchParams({
						error: 'access_denied',
						...(oauthRequest.state ? { state: oauthRequest.state } : {})
					});
					return res.redirect(`${oauthRequest.redirectUri}?${errorParams.toString()}`);
				}

				const code = await this.service.createOAuthAppAuthorizationCode({
					userId: oauthUser.id,
					tenantId: oauthUser.tenantId,
					clientId: oauthRequest.clientId,
					redirectUri: oauthRequest.redirectUri,
					scope: oauthRequest.scope,
					state: oauthRequest.state
				});

				const params = new URLSearchParams({
					code,
					...(oauthRequest.state ? { state: oauthRequest.state } : {})
				});
				return res.redirect(`${oauthRequest.redirectUri}?${params.toString()}`);
			} catch (error: any) {
				console.error('OAuth app authorization code creation failed:', error?.message, error?.stack);
				const errorParams = new URLSearchParams({
					error: 'server_error',
					...(oauthRequest.state ? { state: oauthRequest.state } : {})
				});
				return res.redirect(`${oauthRequest.redirectUri}?${errorParams.toString()}`);
			}
		}

		const { success, authData } = await this.service.validateOAuthLoginEmail(user.emails);
		return this.service.routeRedirect(success, authData, res);
	}
}
