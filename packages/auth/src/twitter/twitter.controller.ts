import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '@gauzy/common';
import { SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';

@Controller()
@UseGuards(AuthGuard('twitter'))
@Public()
export class TwitterController {

	constructor(
		public readonly service: SocialAuthService
	) { }

	/**
	 * Initiates Twitter login.
	 *
	 * @param req
	 */
	@Get('twitter')
	twitterOAuthLogin(@Req() req: any) { }

	/**
	 * Twitter login callback endpoint.
	 *
	 * @param requestCtx - The context of the incoming request.
	 * @param res - The response object.
	 * @returns The result of the Twitter login callback.
	 */
	@Get('twitter/callback')
	async twitterOAuthCallback(
		@RequestCtx() requestCtx: IIncomingRequest,
		@Res() res: any
	) {
		const { user } = requestCtx;
		const { success, authData } = await this.service.validateOAuthLoginEmail(user.emails);
		return this.service.routeRedirect(success, authData, res);
	}
}
