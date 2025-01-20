import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FeatureFlagEnabledGuard, FeatureFlag, Public } from '@gauzy/common';
import { FeatureEnum } from '@gauzy/contracts';
import { SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';

@UseGuards(FeatureFlagEnabledGuard, AuthGuard('linkedin'))
@FeatureFlag(FeatureEnum.FEATURE_LINKEDIN_LOGIN)
@Public()
@Controller('/auth')
export class LinkedinController {
	constructor(public readonly service: SocialAuthService) {}

	/**
	 * Initiates LinkedIn login.
	 *
	 * @param req
	 */
	@Get('/linkedin')
	linkedinLogin(@Req() req: any) {}

	/**
	 * LinkedIn login callback endpoint.
	 *
	 * @param requestCtx - The context of the incoming request.
	 * @param res - The response object.
	 * @returns The result of the LinkedIn login callback.
	 */
	@Get('/linkedin/callback')
	async linkedinLoginCallback(@RequestCtx() requestCtx: IIncomingRequest, @Res() res) {
		const { user } = requestCtx;
		const { success, authData } = await this.service.validateOAuthLoginEmail(user.emails);

		return this.service.routeRedirect(success, authData, res);
	}
}
