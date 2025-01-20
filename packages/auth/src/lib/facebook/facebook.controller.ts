import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
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
	facebookLogin(@Req() req: any) {}

	/**
	 * Facebook login callback endpoint.
	 *
	 * @param requestCtx - The context of the incoming request.
	 * @param res - The response object.
	 * @returns The result of the Facebook login callback.
	 */
	@Get('/facebook/callback')
	async facebookLoginCallback(@RequestCtx() requestCtx: IIncomingRequest, @Res() res) {
		const { user } = requestCtx;
		const { success, authData } = await this.service.validateOAuthLoginEmail(user.emails);
		return this.service.routeRedirect(success, authData, res);
	}
}
