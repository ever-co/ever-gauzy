import { Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SocialAuthService } from './../social-auth.service';
import {
	IIncomingRequest,
	RequestCtx
} from './../decorators/request-context.decorator';

export abstract class Auth0Controller<T> {
	constructor(public readonly service: SocialAuthService) {}

	@Get('auth0')
	@UseGuards(AuthGuard('auth0'))
	auth0Login?(@Req() req) {}

	@Get('auth0/callback')
	@UseGuards(AuthGuard('auth0'))
	async auth0LoginCallback?(
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
