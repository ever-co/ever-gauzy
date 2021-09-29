import { Controller, Get, Req, Res, SetMetadata, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SocialAuthService } from './../social-auth.service';
import { IIncomingRequest, RequestCtx } from './../request-context.decorator';

@Controller('microsoft')
@SetMetadata('isPublic', true)
export class MicrosoftController {
	constructor(public readonly service: SocialAuthService) {}

	@Get('')
	@UseGuards(AuthGuard('microsoft'))
	microsoftLogin(@Req() req: any) {}

	@Get('callback')
	@UseGuards(AuthGuard('microsoft'))
	async microsoftLoginCallback(
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
