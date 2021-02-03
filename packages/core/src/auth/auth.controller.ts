import {
	Controller,
	Post,
	HttpStatus,
	HttpCode,
	Body,
	Get,
	Res,
	Req,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { User as IUser } from '../user/user.entity';
import { CommandBus } from '@nestjs/cqrs';
import { AuthRegisterCommand } from './commands';
import { RequestContext } from '../core/context';
import {
	IAuthLoginInput,
	IAuthResponse,
	IUserRegistrationInput,
	LanguagesEnum
} from '@gauzy/contracts';
import { getUserDummyImage } from '../core';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { AuthLoginCommand } from './commands/auth.login.command';
import { IIncomingRequest, RequestCtx } from '@gauzy/auth';

@ApiTags('Auth')
@Controller()
export class AuthController {
	clientBaseUrl: string;

	constructor(
		private readonly authService: AuthService,
		private readonly commandBus: CommandBus,
		private readonly configService: ConfigService
	) {
		this.clientBaseUrl = this.configService.get(
			'clientBaseUrl'
		) as keyof IEnvironment;
	}

	@ApiOperation({ summary: 'Is authenticated' })
	@ApiResponse({ status: HttpStatus.OK })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST })
	@Get('/authenticated')
	async authenticated(): Promise<boolean> {
		const token = RequestContext.currentToken();
		return this.authService.isAuthenticated(token);
	}

	@ApiOperation({ summary: 'Has role?' })
	@ApiResponse({ status: HttpStatus.OK })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST })
	@Get('/role')
	async hasRole(@Query('roles') roles: string[]): Promise<boolean> {
		const token = RequestContext.currentToken();
		return this.authService.hasRole(token, roles);
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/register')
	async create(
		@Body() entity: IUserRegistrationInput,
		@Req() request: Request,
		@I18nLang() languageCode: LanguagesEnum,
		...options: any[]
	): Promise<IUser> {
		if (!entity.user.imageUrl) {
			entity.user.imageUrl = getUserDummyImage(entity.user);
		}
		entity.originalUrl = request.get('Origin');
		return this.commandBus.execute(
			new AuthRegisterCommand(entity, languageCode)
		);
	}

	@HttpCode(HttpStatus.OK)
	@Post('/login')
	async login(
		@Body() entity: IAuthLoginInput,
		...options: any[]
	): Promise<IAuthResponse | null> {
		return this.commandBus.execute(new AuthLoginCommand(entity));
	}

	@Post('/reset-password')
	async resetPassword(@Body() findObject, ...options: any[]) {
		return await this.authService.resetPassword(findObject);
	}

	@Post('/request-password')
	async requestPass(
		@Body() findObj,
		@Req() request: Request,
		@I18nLang() languageCode: LanguagesEnum,
		...options: any[]
	): Promise<{ id: string; token: string } | null> {
		return await this.authService.requestPassword(
			findObj,
			languageCode,
			request.get('Origin')
		);
	}

	@Get('google')
	@UseGuards(AuthGuard('google'))
	googleLogin(@Req() req) {}

	@Get('google/callback')
	@UseGuards(AuthGuard('google'))
	async googleLoginCallback(
		@RequestCtx() requestCtx: IIncomingRequest,
		@Res() res
	) {
		const { user } = requestCtx;
		const {
			success,
			authData: { jwt, userId }
		} = await this.authService.validateOAuthLoginEmail(user.emails);

		if (success) {
			return res.redirect(
				`${this.clientBaseUrl}/#/sign-in/success?jwt=${jwt}&userId=${userId}`
			);
		} else {
			return res.redirect(`${this.clientBaseUrl}/#/auth/register`);
		}
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
			authData: { jwt, userId }
		} = await this.authService.validateOAuthLoginEmail(user.emails);

		if (success) {
			return res.redirect(
				`${this.clientBaseUrl}/#/sign-in/success?jwt=${jwt}&userId=${userId}`
			);
		} else {
			return res.redirect(`${this.clientBaseUrl}/#/auth/register`);
		}
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
			authData: { jwt, userId }
		} = await this.authService.validateOAuthLoginEmail(user.emails);

		if (success) {
			return res.redirect(
				`${this.clientBaseUrl}/#/sign-in/success?jwt=${jwt}&userId=${userId}`
			);
		} else {
			return res.redirect(`${this.clientBaseUrl}/#/auth/register`);
		}
	}

	@Get('facebook')
	async requestFacebookRedirectUrl(@Req() req, @Res() res) {
		const {
			redirectUri
		} = await this.authService.requestFacebookRedirectUri();
		return res.redirect(redirectUri);
	}

	@Get('facebook/callback')
	async facebookCallback(
		@RequestCtx() requestCtx: IIncomingRequest,
		@Res() res
	): Promise<any> {
		const { code } = requestCtx.query;
		return await this.authService.facebookSignIn(code, res);
	}

	@Post('facebook/token')
	async requestJsonWebTokenAfterFacebookSignIn(
		@RequestCtx() requestCtx: IIncomingRequest,
		@Res() res
	) {
		const { user } = requestCtx;
		const {
			success,
			authData: { jwt, userId }
		} = await this.authService.validateOAuthLoginEmail(user.emails);

		if (success) {
			return res.redirect(
				`${this.clientBaseUrl}/#/sign-in/success?jwt=${jwt}&userId=${userId}`
			);
		} else {
			return res.redirect(`${this.clientBaseUrl}/#/auth/register`);
		}
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
			authData: { jwt, userId }
		} = await this.authService.validateOAuthLoginEmail(user.emails);

		if (success) {
			return res.redirect(
				`${this.clientBaseUrl}/#/sign-in/success?jwt=${jwt}&userId=${userId}`
			);
		} else {
			return res.redirect(`${this.clientBaseUrl}/#/auth/register`);
		}
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
			authData: { jwt, userId }
		} = await this.authService.validateOAuthLoginEmail(user.emails);

		if (success) {
			return res.redirect(
				`${this.clientBaseUrl}/#/sign-in/success?jwt=${jwt}&userId=${userId}`
			);
		} else {
			return res.redirect(`${this.clientBaseUrl}/#/auth/register`);
		}
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
			authData: { jwt, userId }
		} = await this.authService.validateOAuthLoginEmail(user.emails);

		if (success) {
			return res.redirect(
				`${this.clientBaseUrl}/#/sign-in/success?jwt=${jwt}&userId=${userId}`
			);
		} else {
			return res.redirect(`${this.clientBaseUrl}/#/auth/register`);
		}
	}
}
