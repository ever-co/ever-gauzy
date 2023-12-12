import {
	Controller,
	Post,
	HttpStatus,
	HttpCode,
	Body,
	Get,
	Headers,
	Query,
	UsePipes,
	ValidationPipe,
	UseGuards,
	BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiOkResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { I18nLang } from 'nestjs-i18n';
import { IAuthResponse, IUserSigninWorkspaceResponse, LanguagesEnum } from '@gauzy/contracts';
import { Public, parseToBoolean } from '@gauzy/common';
import { AuthService } from './auth.service';
import { User as IUser } from '../user/user.entity';
import { AuthLoginCommand, AuthRegisterCommand, WorkspaceSigninSendCodeCommand, WorkspaceSigninVerifyTokenCommand } from './commands';
import { RequestContext } from '../core/context';
import { AuthRefreshGuard } from './../shared/guards';
import { ChangePasswordRequestDTO, ResetPasswordRequestDTO } from './../password-reset/dto';
import {
	RegisterUserDTO,
	UserEmailDTO,
	UserLoginDTO,
	UserSigninWorkspaceDTO
} from './../user/dto';
import { UserService } from './../user/user.service';
import {
	HasPermissionsQueryDTO,
	HasRoleQueryDTO,
	RefreshTokenDto,
	WorkspaceSigninEmailVerifyDTO,
	WorkspaceSigninDTO
} from './dto';

@ApiTags('Auth')
@Controller()
export class AuthController {

	constructor(
		private readonly authService: AuthService,
		private readonly userService: UserService,
		private readonly commandBus: CommandBus
	) { }

	/**
	 * Check if the user is authenticated.
	 *
	 * @returns
	 */
	@ApiOperation({ summary: 'Check if user is authenticated' })
	@ApiOkResponse({ status: HttpStatus.OK, description: 'The success server response' })
	@ApiBadRequestResponse({ status: HttpStatus.BAD_REQUEST, })
	@Get('/authenticated')
	@Public()
	async authenticated(): Promise<boolean> {
		const token = RequestContext.currentToken();
		return await this.authService.isAuthenticated(token);
	}

	/**
	 * Check if the user has a specific role.
	 *
	 * @param query - Query parameters containing roles.
	 * @returns
	 */
	@ApiOperation({ summary: 'Check if the user has a specific role' })
	@ApiResponse({ status: HttpStatus.OK })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST })
	@Get('/role')
	@UsePipes(new ValidationPipe())
	async hasRole(
		@Query() query: HasRoleQueryDTO
	): Promise<boolean> {
		return await this.authService.hasRole(query.roles);
	}

	/**
	 * Check if the user has specific permissions.
	 *
	 * @param query - Query parameters containing permissions.
	 * @returns
	 */
	@ApiOperation({ summary: 'Check if the user has specific permissions' })
	@ApiResponse({ status: HttpStatus.OK })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST })
	@Get('/permissions')
	@UsePipes(new ValidationPipe())
	async hasPermissions(
		@Query() query: HasPermissionsQueryDTO
	): Promise<boolean> {
		return await this.authService.hasPermissions(query.permissions);
	}

	/**
	 * Register a new user.
	 *
	 * @param input - User registration data.
	 * @param languageCode - Language code.
	 * @param origin - Origin
	 * @returns
	 */
	@ApiOperation({ summary: 'Register a new user' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.',
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, the response body may contain clues as to what went wrong',
	})
	@Post('/register')
	@Public()
	@UsePipes(new ValidationPipe({ transform: true }))
	async register(
		@Body() input: RegisterUserDTO,
		@I18nLang() languageCode: LanguagesEnum,
		@Headers('origin') origin: string
	): Promise<IUser> {
		return await this.commandBus.execute(
			new AuthRegisterCommand({
				originalUrl: origin, ...input
			},
				languageCode
			)
		);
	}

	/**
	 * User login.
	 *
	 * @param input - User login data.
	 * @returns
	 */
	@HttpCode(HttpStatus.OK)
	@Post('/login')
	@Public()
	@UsePipes(new ValidationPipe({ transform: true }))
	async login(
		@Body() input: UserLoginDTO
	): Promise<IAuthResponse | null> {
		return await this.commandBus.execute(
			new AuthLoginCommand(input)
		);
	}

	/**
	 * Sign in workspaces by email and password.
	 *
	 * @param input - User sign-in data.
	 * @returns
	 */
	@HttpCode(HttpStatus.OK)
	@Post('/signin.email.password')
	@Public()
	@UsePipes(new ValidationPipe())
	async signinWorkspacesByPassword(
		@Body() input: UserSigninWorkspaceDTO
	): Promise<IUserSigninWorkspaceResponse> {
		return await this.authService.signinWorkspacesByEmailPassword(input);
	}

	/**
	 * Send a workspace sign-in code by email.
	 *
	 * @param entity - User email data.
	 * @param locale - Language code.
	 * @returns
	 */
	@HttpCode(HttpStatus.OK)
	@Post('/signin.email')
	@Public()
	@UsePipes(new ValidationPipe({ transform: true }))
	async sendWorkspaceSigninCode(
		@Body() entity: UserEmailDTO,
		@I18nLang() locale: LanguagesEnum
	): Promise<any> {
		return await this.commandBus.execute(
			new WorkspaceSigninSendCodeCommand(entity, locale)
		);
	}

	/**
	 * Confirm workspace sign-in by email code.
	 *
	 * @param input - Workspace sign-in email verification data.
	 * @returns
	 */
	@Post('/signin.email/confirm')
	@Public()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async confirmWorkspaceSigninByCode(
		@Query() query: Record<string, boolean>,
		@Body() input: WorkspaceSigninEmailVerifyDTO,
	): Promise<any> {
		return await this.authService.confirmWorkspaceSigninByCode(
			input,
			parseToBoolean(query.includeTeams)
		);
	}

	/**
	 * Sign in to a workspace by token.
	 *
	 * @param input - Workspace sign-in data.
	 * @returns
	 */
	@Post('/signin.workspace')
	@Public()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async signinWorkspaceByToken(
		@Body() input: WorkspaceSigninDTO
	): Promise<IAuthResponse | null> {
		return await this.commandBus.execute(
			new WorkspaceSigninVerifyTokenCommand(input)
		);
	}

	/**
	 * Reset the user's password.
	 *
	 * @param request - Password change request data.
	 * @returns
	 */
	@Post('/reset-password')
	@Public()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async resetPassword(
		@Body() request: ChangePasswordRequestDTO
	) {
		return await this.authService.resetPassword(request);
	}

	/**
	 * Request a password reset.
	 *
	 * @param body - Password reset request data.
	 * @param origin - Origin Request Header.
	 * @param languageCode - Language code.
	 * @returns
	 */
	@Post('/request-password')
	@Public()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async requestPassword(
		@Body() body: ResetPasswordRequestDTO,
		@Headers('origin') origin: string,
		@I18nLang() languageCode: LanguagesEnum,
	): Promise<boolean | BadRequestException> {
		return await this.authService.requestResetPassword(
			body,
			languageCode,
			origin
		);
	}

	/**
	 * Logout (Removed refresh token from database)
	 *
	 * @returns
	 */
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Logout' })
	@Get('/logout')
	async getLogOut() {
		return await this.userService.removeRefreshToken();
	}

	/**
	 * Refresh the access token using a refresh token.
	 *
	 * @param input - Refresh token data.
	 * @returns
	 */
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Refresh token' })
	@Public()
	@UseGuards(AuthRefreshGuard)
	@Post('/refresh-token')
	@UsePipes(new ValidationPipe())
	async refreshToken(
		@Body() input: RefreshTokenDto
	) {
		return await this.authService.getAccessTokenFromRefreshToken();
	}
}
