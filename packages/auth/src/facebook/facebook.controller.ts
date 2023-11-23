import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '@gauzy/common';
import { SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';

@Controller()
@UseGuards(AuthGuard('facebook'))
@Public()
export class FacebookController {

	constructor(
		public readonly service: SocialAuthService
	) { }

	/**
	 * Initiates Facebook login.
	 *
	 * @param req
	 */
	@Get('facebook')
	facebookLogin(@Req() req: any) { }

	/**
	 * Facebook login callback endpoint.
	 *
	 * @param requestCtx - The context of the incoming request.
	 * @param res - The response object.
	 * @returns The result of the Facebook login callback.
	 */
	@Get('facebook/callback')
	async facebookLoginCallback(
		@RequestCtx() requestCtx: IIncomingRequest,
		@Res() res
	) {
		const { user } = requestCtx;
		const { success, authData } = await this.service.validateOAuthLoginEmail(user.emails);
		return this.service.routeRedirect(success, authData, res);
	}
}
