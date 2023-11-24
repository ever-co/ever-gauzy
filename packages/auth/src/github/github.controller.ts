import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FeatureFlag, FeatureFlagEnabledGuard, Public } from '@gauzy/common';
import { FeatureEnum } from '@gauzy/contracts';
import { SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';

@Controller()
@UseGuards(FeatureFlagEnabledGuard, AuthGuard('github'))
@FeatureFlag(FeatureEnum.FEATURE_GITHUB_LOGIN)
@Public()
export class GithubController {

	constructor(
		public readonly service: SocialAuthService
	) { }

	/**
	 * Initiates GitHub login.
	 *
	 * @param req
	 */
	@Get('github')
	githubLogin(@Req() req: any) { }

	/**
	 * GitHub login callback endpoint.
	 *
	 * @param requestCtx - The context of the incoming request.
	 * @param res - The response object.
	 * @returns The result of the GitHub login callback.
	 */
	@Get('github/callback')
	async githubLoginCallback(
		@RequestCtx() requestCtx: IIncomingRequest,
		@Res() res: any
	) {
		const { user } = requestCtx;
		const { success, authData } = await this.service.validateOAuthLoginEmail(user.emails);
		return this.service.routeRedirect(success, authData, res);
	}
}
