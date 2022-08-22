import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '@gauzy/common';
import { SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';

@Controller('github')
@Public()
export class GithubController {
	constructor(public readonly service: SocialAuthService) {}

	@Get('')
	@UseGuards(AuthGuard('github'))
	githubLogin(@Req() req: any) {}

	@Get('callback')
	@UseGuards(AuthGuard('github'))
	async githubLoginCallback(
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
