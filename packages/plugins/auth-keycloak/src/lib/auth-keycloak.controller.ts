import { Controller, Get, Header, Inject, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '@gauzy/common';
import { KeycloakPublicConfig, KeycloakSignInService } from './keycloak-sign-in.service';
import { SOCIAL_SIGN_IN, SocialSignInPort } from './social-sign-in.port';

/**
 * Keycloak sign-in routes. They exist only while the plugin is loaded (`KEYCLOAK_ENABLED=true` with a
 * client id and secret); otherwise every `/api/auth/keycloak*` path answers 404.
 */
@Public()
@Controller('/auth/keycloak')
export class AuthKeycloakController {
	constructor(
		private readonly signIn: KeycloakSignInService,
		@Inject(SOCIAL_SIGN_IN) private readonly socialSignIn: SocialSignInPort
	) {}

	/**
	 * Tells the login page whether to show the Keycloak button.
	 */
	@Get('/config')
	@Header('Cache-Control', 'no-store')
	getConfig(): KeycloakPublicConfig {
		return this.signIn.publicConfig();
	}

	/**
	 * Starts a Keycloak sign-in: redirects to the realm's authorize endpoint.
	 */
	@Get()
	@Header('Cache-Control', 'no-store')
	async start(@Res() res: Response): Promise<void> {
		const url = await this.signIn.start(res);
		res.redirect(302, url);
	}

	/**
	 * Keycloak redirects back here. A verified e-mail signs the person in to the Gauzy account that owns
	 * it, exactly as the other social sign-ins do; an unknown e-mail goes to the register page and
	 * nothing is created.
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
		const { success, authData } = await this.socialSignIn.validateOAuthLoginEmail([
			{ value: result.email, verified: true }
		]);
		await this.socialSignIn.routeRedirect(success, authData, res);
	}
}
