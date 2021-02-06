import { Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SocialAuthService } from './../social-auth.service';
import {
	IIncomingRequest,
	RequestCtx
} from './../decorators/request-context.decorator';

export abstract class FacebookController<T> {
	constructor(public readonly service: SocialAuthService) {}

	@Get('facebook')
	@UseGuards(AuthGuard('facebook'))
	facebooLogin?(@Req() req) {}

	@Get('facebook/callback')
	@UseGuards(AuthGuard('facebook'))
	async facebooLoginCallback?(
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
