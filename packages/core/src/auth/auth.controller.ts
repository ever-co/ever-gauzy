import {
	Controller,
	Post,
	HttpStatus,
	HttpCode,
	Body,
	Get,
	Req,
	Query,
	UsePipes,
	ValidationPipe,
	UseGuards,
	BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiOkResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { IAuthResponse, LanguagesEnum } from '@gauzy/contracts';
import { Public } from '@gauzy/common';
import { AuthService } from './auth.service';
import { User as IUser } from '../user/user.entity';
import { AuthLoginCommand, AuthRegisterCommand, SendAuthCodeCommand, VerifyAuthCodeCommand } from './commands';
import { RequestContext } from '../core/context';
import { AuthRefreshGuard } from './../shared/guards';
import { ChangePasswordRequestDTO, ResetPasswordRequestDTO } from './../password-reset/dto';
import { RegisterUserDTO, UserLoginDTO } from './../user/dto';
import { UserService } from './../user/user.service';
import { HasPermissionsQueryDTO, HasRoleQueryDTO, RefreshTokenDto, SendAuthCodeDTO, VerifyAuthCodeDTO } from './dto';

@ApiTags('Auth')
@Controller()
export class AuthController {

	constructor(
		private readonly authService: AuthService,
		private readonly userService: UserService,
		private readonly commandBus: CommandBus
	) { }

	/**
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
	 *
	 * @param query
	 * @returns
	 */
	@ApiOperation({ summary: 'Has role?' })
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
	 * Current user has permissions
	 *
	 * @param query
	 * @returns
	 */
	@ApiOperation({ summary: 'Has permissions?' })
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
	 *
	 * @param entity
	 * @param request
	 * @param languageCode
	 * @returns
	 */
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
	@Public()
	@UsePipes(new ValidationPipe({ transform: true }))
	async register(
		@Body() entity: RegisterUserDTO,
		@Req() request: Request,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<IUser> {
		return await this.commandBus.execute(
			new AuthRegisterCommand({
				originalUrl: request.get('Origin'), ...entity
			},
				languageCode
			)
		);
	}

	/**
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.OK)
	@Post('/login')
	@Public()
	@UsePipes(new ValidationPipe({ transform: true }))
	async login(
		@Body() entity: UserLoginDTO
	): Promise<IAuthResponse | null> {
		return await this.commandBus.execute(
			new AuthLoginCommand(entity)
		);
	}

	/**
	 * Send invite code on email
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.OK)
	@Post('/send-code')
	@Public()
	@UsePipes(new ValidationPipe({ transform: true }))
	async sendInviteCode(
		@Body() entity: SendAuthCodeDTO
	): Promise<any> {
		return await this.commandBus.execute(
			new SendAuthCodeCommand(entity)
		);
	}

	/**
	 * Verify invite code along with email
	 *
	 * @param entity
	 */
	@Post('/verify-code')
	@Public()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async confirmInviteCode(
		@Body() entity: VerifyAuthCodeDTO
	): Promise<any> {
		return await this.commandBus.execute(
			new VerifyAuthCodeCommand(entity)
		);
	}

	/**
	 *
	 * @param request
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
	 *
	 * @param body
	 * @param request
	 * @param languageCode
	 * @returns
	 */
	@Post('/request-password')
	@Public()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async requestPassword(
		@Body() body: ResetPasswordRequestDTO,
		@Req() request: Request,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<boolean | BadRequestException> {
		return await this.authService.requestPassword(
			body,
			languageCode,
			request.get('Origin')
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
	 *
	 *
	 * @param body
	 * @returns
	 */
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Refresh token' })
	@Public()
	@UseGuards(AuthRefreshGuard)
	@Post('/refresh-token')
	@UsePipes(new ValidationPipe())
	async refreshToken(@Body() body: RefreshTokenDto) {
		return await this.authService.getAccessTokenFromRefreshToken();
	}
}
