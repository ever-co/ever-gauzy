import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '@gauzy/common';
import { SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';

@Controller('auth0')
@Public()
export class Auth0Controller {
	constructor(public readonly service: SocialAuthService) {}

	/**
	 * Handles the initial Auth0 login request.
	 *
	 * @param req - The incoming request object, typically used to access request data or user information.
	 */
	@Get('')
	@UseGuards(AuthGuard('auth0'))
	auth0Login(@Req() req: any) {}

	/**
	 * Handles the callback from Auth0 after a successful login.
	 *
	 * @param requestCtx - The context of the incoming request, including the authenticated user information.
	 * @param res - The response object used to send a redirect or response to the client.
	 * @returns {Promise<void>} - A promise that resolves after redirecting the user.
	 */
	@Get('callback')
	@UseGuards(AuthGuard('auth0'))
	async auth0LoginCallback(
		@RequestCtx() requestCtx: IIncomingRequest,
		@Res() res
	) {
		const { user } = requestCtx;
		const {
			success,
			authData
		} = await this.service.validateOAuthLoginEmail(user.emails);
		return this.service.routeRedirect(success, authData, res);
	}
}
