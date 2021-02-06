import { Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SocialAuthService } from './../social-auth.service';
import {
	IIncomingRequest,
	RequestCtx
} from './../decorators/request-context.decorator';

export abstract class MicrosoftController<T> {
	constructor(public readonly service: SocialAuthService) {}

	@Get('microsoft')
	@UseGuards(AuthGuard('microsoft'))
	microsoftLogin?(@Req() req) {}

	@Get('microsoft/callback')
	@UseGuards(AuthGuard('microsoft'))
	async microsoftLoginCallback?(
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
