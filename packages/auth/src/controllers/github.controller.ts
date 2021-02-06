import { Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SocialAuthService } from './../social-auth.service';
import {
	IIncomingRequest,
	RequestCtx
} from './../decorators/request-context.decorator';

export abstract class GithubController<T> {
	constructor(public readonly service: SocialAuthService) {}

	@Get('github')
	@UseGuards(AuthGuard('github'))
	githubLogin?(@Req() req) {}

	@Get('github/callback')
	@UseGuards(AuthGuard('github'))
	async githubLoginCallback?(
		@RequestCtx() requestCtx: IIncomingRequest,
		@Res() res: any
	) {
		const { user } = requestCtx;
		const {
			success,
			authData
		} = await this.service.validateOAuthLoginEmail(user.emails);
		return this.service.routeRedirect(success, authData, res);
	}
}
