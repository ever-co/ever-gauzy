import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '@gauzy/common';
import { SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';

@Controller()
@UseGuards(AuthGuard('microsoft'))
@Public()
export class MicrosoftController {

	constructor(
		public readonly service: SocialAuthService
	) { }

	/**
	 * Initiates Microsoft login.
	 *
	 * @param req
	 */
	@Get('microsoft')
	microsoftOAuthLogin(@Req() req: any) { }

	/**
	 * Microsoft login callback endpoint.
	 *
	 * @param requestCtx - The context of the incoming request.
	 * @param res - The response object.
	 * @returns The result of the Microsoft login callback.
	 */
	@Get('microsoft/callback')
	async microsoftOAuthCallback(
		@RequestCtx() requestCtx: IIncomingRequest,
		@Res() res
	) {
		const { user } = requestCtx;
		const { success, authData } = await this.service.validateOAuthLoginEmail(user.emails);
		return this.service.routeRedirect(success, authData, res);
	}
}
