import { Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SocialAuthService } from './../social-auth.service';
import {
	IIncomingRequest,
	RequestCtx
} from './../decorators/request-context.decorator';

export abstract class GoogleController<T> {
	constructor(public readonly service: SocialAuthService) {}

	@Get('google')
	@UseGuards(AuthGuard('google'))
	googleLogin?(@Req() req) {}

	@Get('google/callback')
	@UseGuards(AuthGuard('google'))
	async googleLoginCallback?(
		@RequestCtx() requestCtx: IIncomingRequest,
		@Res() res
	) {
		console.log(requestCtx);
		const { user } = requestCtx;
		const {
			success,
			authData
		} = await this.service.validateOAuthLoginEmail(user.emails);
		return this.service.routeRedirect(success, authData, res);
	}
}
