import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '@gauzy/common';
import { SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';

@Controller()
@UseGuards(AuthGuard('google'))
@Public()
export class GoogleController {
	constructor(public readonly service: SocialAuthService) { }

	/**
	 * Initiates Google login.
	 *
	 * @param req
	 */
	@Get('google')
	googleOAuthLogin(@Req() req: any) { }

	/**
	 * Google login callback endpoint.
	 *
	 * @param requestCtx - The context of the incoming request.
	 * @param res - The response object.
	 * @returns The result of the Google login callback.
	 */
	@Get('google/callback')
	async googleOAuthCallback(
		@RequestCtx() requestCtx: IIncomingRequest,
		@Res() res
	) {
		const { user } = requestCtx;
		const { success, authData } = await this.service.validateOAuthLoginEmail(user.emails);
		return this.service.routeRedirect(success, authData, res);
	}
}
