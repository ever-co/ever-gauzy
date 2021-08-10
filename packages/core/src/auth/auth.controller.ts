import {
	Controller,
	Post,
	HttpStatus,
	HttpCode,
	Body,
	Get,
	Req,
	Query,
	UseInterceptors
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import {
	IAuthLoginInput,
	IAuthResponse,
	IUserRegistrationInput,
	LanguagesEnum
} from '@gauzy/contracts';
import { AuthService } from './auth.service';
import { User as IUser } from '../user/user.entity';
import { AuthRegisterCommand } from './commands';
import { RequestContext } from '../core/context';
import { getUserDummyImage } from '../core';
import { AuthLoginCommand } from './commands';
import { TransformInterceptor } from './../core/interceptors';
import { Public } from './../shared/decorators';

@ApiTags('Auth')
@UseInterceptors(TransformInterceptor)
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
	@Public()
	async authenticated(): Promise<boolean> {
		const token = RequestContext.currentToken();
		return await this.authService.isAuthenticated(token);
	}

	@ApiOperation({ summary: 'Has role?' })
	@ApiResponse({ status: HttpStatus.OK })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST })
	@Get('/role')
	async hasRole(@Query('roles') roles: string[]): Promise<boolean> {
		const token = RequestContext.currentToken();
		return await this.authService.hasRole(token, roles);
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
	@Public()
	async create(
		@Body() entity: IUserRegistrationInput,
		@Req() request: Request,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<IUser> {
		if (!entity.user.imageUrl) {
			entity.user.imageUrl = getUserDummyImage(entity.user);
		}
		entity.originalUrl = request.get('Origin');
		return await this.commandBus.execute(
			new AuthRegisterCommand(entity, languageCode)
		);
	}

	@HttpCode(HttpStatus.OK)
	@Post('/login')
	@Public()
	async login(
		@Body() entity: IAuthLoginInput
	): Promise<IAuthResponse | null> {
		return await this.commandBus.execute(new AuthLoginCommand(entity));
	}

	@Post('/reset-password')
	@Public()
	async resetPassword(@Body() findObject) {
		return await this.authService.resetPassword(findObject);
	}

	@Post('/request-password')
	@Public()
	async requestPassword(
		@Body() findObj,
		@Req() request: Request,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<{ id: string; token: string } | null> {
		return await this.authService.requestPassword(
			findObj,
			languageCode,
			request.get('Origin')
		);
	}
}
