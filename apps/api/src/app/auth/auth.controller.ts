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
import { UserRegistrationInput as IUserRegistrationInput } from '@gauzy/models';
import { getUserDummyImage } from '../core';
import { environment as env } from '@env-api/environment';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Auth')
@Controller()
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly commandBus: CommandBus
	) {}

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
		...options: any[]
	): Promise<IUser> {
		if (!entity.user.imageUrl) {
			entity.user.imageUrl = getUserDummyImage(entity.user);
		}
		return this.commandBus.execute(new AuthRegisterCommand(entity));
	}

	@HttpCode(HttpStatus.OK)
	@Post('/login')
	async login(
		@Body() { findObj, password },
		...options: any[]
	): Promise<{ user: IUser; token: string } | null> {
		return this.authService.login(findObj, password);
	}

	@Post('/reset-password')
	async resetPassword(@Body() findObject, ...options: any[]) {
		return await this.authService.resetPassword(findObject);
	}

	@Post('/request-password')
	async requestPass(
		@Body() findObj,
		...options: any[]
	): Promise<{ id: string; token: string } | null> {
		return await this.authService.requestPassword(findObj);
	}

	@Get('google')
	@UseGuards(AuthGuard('google'))
	googleLogin() {}

	@Get('google/callback')
	@UseGuards(AuthGuard('google'))
	googleLoginCallback(@Req() req, @Res() res) {
		const {
			success,
			authData: { jwt, userId }
		} = req.user;

		if (success) {
			return res.redirect(
				`${env.host}:4200/#/sign-in/success?jwt=${jwt}&userId=${userId}`
			);
		} else {
			return res.redirect(`${env.host}:4200/#/auth/register`);
		}
	}

	@Get('facebook')
	async requestFacebookRedirectUrl(@Res() res) {
		const {
			redirectUri
		} = await this.authService.requestFacebookRedirectUri();
		return res.redirect(redirectUri);
	}

	@Get('facebook/callback')
	async facebookCallback(@Req() req, @Res() res): Promise<any> {
		const { code } = req.query;
		return await this.authService.facebookSignIn(code, res);
	}

	@Post('facebook/token')
	requestJsonWebTokenAfterFacebookSignIn(@Req() req, @Res() res) {
		const {
			success,
			authData: { jwt, userId }
		} = req.user;

		if (success) {
			return res.redirect(
				`${env.host}:4200/#/sign-in/success?jwt=${jwt}&userId=${userId}`
			);
		} else {
			return res.redirect(`${env.host}:4200/#/auth/register`);
		}
	}
}
