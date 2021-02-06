import { Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SocialAuthService } from './../social-auth.service';
import {
	IIncomingRequest,
	RequestCtx
} from './../decorators/request-context.decorator';

export abstract class TwitterController<T> {
	constructor(public readonly service: SocialAuthService) {}

	@Get('twitter')
	@UseGuards(AuthGuard('twitter'))
	twitterLogin?(@Req() req) {}

	@Get('twitter/callback')
	@UseGuards(AuthGuard('twitter'))
	async twitterLoginCallback?(
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
