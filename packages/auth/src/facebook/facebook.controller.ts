import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';

@Controller('facebook')
export class FacebookController {
	constructor(public readonly service: SocialAuthService) {}

	@Get('')
	@UseGuards(AuthGuard('facebook'))
	facebooLogin(@Req() req: any) {}

	@Get('callback')
	@UseGuards(AuthGuard('facebook'))
	async facebooLoginCallback(
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
