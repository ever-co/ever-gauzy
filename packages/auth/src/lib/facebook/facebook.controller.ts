import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { FeatureFlagEnabledGuard, FeatureFlag, Public } from '@gauzy/common';
import { FeatureEnum } from '@gauzy/contracts';
import { SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';

@UseGuards(FeatureFlagEnabledGuard, AuthGuard('facebook'))
@FeatureFlag(FeatureEnum.FEATURE_FACEBOOK_LOGIN)
@Public()
@Controller('/auth')
export class FacebookController {
	constructor(public readonly service: SocialAuthService) {}

	/**
	 * Initiates Facebook login.
	 *
	 * @param req
	 */
	@Get('/facebook')
	facebookLogin(@Req() _: Request) {}

	/**
	 * Facebook login callback endpoint.
	 *
	 * @param context - The context of the incoming request.
	 * @param res - The response object.
	 * @returns The result of the Facebook login callback.
	 */
	@Get('/facebook/callback')
	async facebookLoginCallback(@RequestCtx() context: IIncomingRequest, @Res() res: Response): Promise<any> {
		const { user } = context;
		const { success, authData } = await this.service.validateOAuthLoginEmail(user.emails);
		return this.service.routeRedirect(success, authData, res);
	}
}
