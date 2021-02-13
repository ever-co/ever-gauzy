import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';

@Controller('twitter')
export class TwitterController {
	constructor(public readonly service: SocialAuthService) {}

	@Get('')
	@UseGuards(AuthGuard('twitter'))
	twitterLogin(@Req() req: any) {}

	@Get('callback')
	@UseGuards(AuthGuard('twitter'))
	async twitterLoginCallback(
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
