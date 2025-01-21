import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { FeatureFlagEnabledGuard, FeatureFlag, Public } from '@gauzy/common';
import { FeatureEnum } from '@gauzy/contracts';
import { SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';

@UseGuards(FeatureFlagEnabledGuard, AuthGuard('twitter'))
@FeatureFlag(FeatureEnum.FEATURE_TWITTER_LOGIN)
@Public()
@Controller('/auth')
export class TwitterController {
	constructor(public readonly service: SocialAuthService) {}

	/**
	 * Initiates Twitter login.
	 *
	 * @param req
	 */
	@Get('/twitter')
	twitterLogin(@Req() _: Request) {}

	/**
	 * Twitter login callback endpoint.
	 *
	 * @param requestCtx - The context of the incoming request.
	 * @param res - The response object.
	 * @returns The result of the Twitter login callback.
	 */
	@Get('/twitter/callback')
	async twitterLoginCallback(@RequestCtx() requestCtx: IIncomingRequest, @Res() res: Response) {
		const { user } = requestCtx;
		const { success, authData } = await this.service.validateOAuthLoginEmail(user.emails);
		return this.service.routeRedirect(success, authData, res);
	}
}
