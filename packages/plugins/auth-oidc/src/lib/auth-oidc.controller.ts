import { Controller, Get, Header, Inject, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '@gauzy/common';
import { AuthOidcPublicConfig, AuthOidcSignInService } from './auth-oidc-sign-in.service';
import { SOCIAL_SIGN_IN, SocialSignInPort } from './social-sign-in.port';

/**
 * OpenID Connect sign-in routes. They exist only while the plugin is loaded (`OIDC_ENABLED=true` with
 * an issuer, a client id and a secret); otherwise every `/api/auth/oidc*` path answers 404.
 */
@Public()
@Controller('/auth/oidc')
export class AuthOidcController {
	constructor(
		private readonly signIn: AuthOidcSignInService,
		@Inject(SOCIAL_SIGN_IN) private readonly socialSignIn: SocialSignInPort
	) {}

	/**
	 * Tells the login page whether to show the button, and its label.
	 */
	@Get('/config')
	@Header('Cache-Control', 'no-store')
	getConfig(): AuthOidcPublicConfig {
		return this.signIn.publicConfig();
	}

	/**
	 * Starts a sign-in: redirects to the provider's authorize endpoint.
	 */
	@Get()
	@Header('Cache-Control', 'no-store')
	async start(@Res() res: Response): Promise<void> {
		const url = await this.signIn.start(res);
		res.redirect(302, url);
	}

	/**
	 * The provider redirects back here. A verified e-mail address signs the person in to the Gauzy account
	 * that owns it, exactly as the other social sign-ins do; an unknown address goes to the register page
	 * and nothing is created.
	 */
	@Get('/callback')
	@Header('Cache-Control', 'no-store')
	async callback(
		@Req() req: Request,
		@Res() res: Response,
		@Query('code') code?: string,
		@Query('state') state?: string,
		@Query('error') error?: string
	): Promise<void> {
		const result = await this.signIn.complete(req, res, { code, state, error });
		if (result.status !== 'verified') {
			const reason = result.status === 'email_unverified' ? 'email_unverified' : 'sign_in_failed';
			res.redirect(302, this.signIn.loginPageUrl(reason));
			return;
		}
		const { success, authData } = await this.socialSignIn.validateOAuthLoginEmail([{ value: result.email, verified: true }]);
		await this.socialSignIn.routeRedirect(success, authData, res);
	}
}
