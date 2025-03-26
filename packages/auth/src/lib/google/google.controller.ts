import { Controller, Get, Logger, Req, Res, UseGuards } from '@nestjs/common';
import { FeatureFlagEnabledGuard, FeatureFlag, Public } from '@gauzy/common';
import { SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';
import { AuthError, FeatureEnum } from '@gauzy/contracts';
import { GoogleAuthGuard } from './google-auth-guard';

@Controller()
@UseGuards(FeatureFlagEnabledGuard, GoogleAuthGuard)
@FeatureFlag(FeatureEnum.FEATURE_GOOGLE_LOGIN)
@Public()
export class GoogleController {
	private readonly logger = new Logger(`GZY - ${GoogleController.name}`);
	constructor(public readonly service: SocialAuthService) { }

	/**
	 * Initiates Google login.
	 *
	 * @param req
	 */
	@Get('google')
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	googleLogin(@Req() req) {
		// Initiate Google login
	}

	/**
	 * Google login callback endpoint.
	 *
	 * @param requestCtx - The context of the incoming request.
	 * @param res - The response object.
	 * @returns The result of the Google login callback.
	 */
	@Get('google/callback')
	async googleLoginCallback(
		@RequestCtx() requestCtx: IIncomingRequest,
		@Res() res
	) {
		const { user } = requestCtx;
		let response = await this.service.validateOAuthLoginEmail(user.emails);

		// User doesn't exist in the database, new account will be created
		if (!response.success) {
			this.logger.verbose(`User doesn't exist in the database, new account will be created: ${JSON.stringify(user)}`);
			response = await this.service.registerOAuth({
				emails: user.emails,
				firstName: user.firstName,
				lastName: user.lastName,
				provider: 'google',
				picture: user.picture?.value
			});
		}
		return this.service.routeRedirect(response.success, response.authData, res, AuthError.INVALID_EMAIL_DOMAIN);
	}
}
