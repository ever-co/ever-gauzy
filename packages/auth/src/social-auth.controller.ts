import { Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SocialAuthService } from 'social-auth.service';
import {
	IIncomingRequest,
	RequestCtx
} from './decorators/request-context.decorator';

export abstract class SocialAuthController {
	constructor(protected readonly service: SocialAuthService) {}

	@Get('google')
	@UseGuards(AuthGuard('google'))
	googleLogin(@Req() req) {}

	@Get('google/callback')
	@UseGuards(AuthGuard('google'))
	async googleLoginCallback(
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

	@Get('linkedin')
	@UseGuards(AuthGuard('linkedin'))
	linkedinLogin(@Req() req) {}

	@Get('linkedin/callback')
	@UseGuards(AuthGuard('linkedin'))
	async linkedinLoginCallback(
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

	@Get('github')
	@UseGuards(AuthGuard('github'))
	githubLogin(@Req() req) {}

	@Get('github/callback')
	@UseGuards(AuthGuard('github'))
	async githubLoginCallback(
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

	@Get('facebook')
	@UseGuards(AuthGuard('facebook'))
	facebookLogin(@Req() req) {}

	@Get('facebook/callback')
	@UseGuards(AuthGuard('facebook'))
	async facebookLoginCallback(
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

	@Get('twitter')
	@UseGuards(AuthGuard('twitter'))
	twitterLogin() {}

	@Get('twitter/callback')
	@UseGuards(AuthGuard('twitter'))
	async twitterLoginCallback(
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

	@Get('microsoft')
	@UseGuards(AuthGuard('microsoft'))
	microsoftLogin() {}

	@Get('microsoft/callback')
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

	@Get('auth0')
	@UseGuards(AuthGuard('auth0'))
	auth0Login() {}

	@Get('auth0/callback')
	@UseGuards(AuthGuard('auth0'))
	async auth0LoginCallback(
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
