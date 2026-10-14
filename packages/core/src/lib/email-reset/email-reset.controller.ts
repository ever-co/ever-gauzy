import { Controller, HttpCode, HttpStatus, UseGuards, Post, Body, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { UseValidationPipe } from '../shared/pipes';
import { EmailResetService, IEmailResetView } from './email-reset.service';
import { EmailResetQueryDTO, ResetEmailRequestDTO, VerifyEmailResetRequestDTO } from './dto';

@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_USERS_EDIT, PermissionsEnum.PROFILE_EDIT)
@Controller('email-reset')
export class EmailResetController {
	constructor(private readonly emailResetService: EmailResetService) { }

	/**
	 * The address-change requests of one user of the caller's tenant, newest first, never with their code or
	 * token. The caller's own by default; another user's needs `ORG_USERS_EDIT`, which the service checks.
	 * Runs under the controller's pair, like the two writes.
	 *
	 * @param query The user whose requests are read; omit it for the caller.
	 * @returns The requests.
	 */
	@ApiOperation({ summary: "List a user's email-change requests, without their secrets." })
	@ApiResponse({ status: HttpStatus.OK, description: 'The requests, newest first.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Another user's requests need ORG_USERS_EDIT." })
	@Get('/')
	@UseValidationPipe({ whitelist: true })
	async findAll(@Query() query: EmailResetQueryDTO): Promise<IEmailResetView[]> {
		return await this.emailResetService.findForUser(query?.userId);
	}

	/**
	 * Create email reset request.
	 *
	 * @param entity
	 * @param languageCode
	 * @returns
	 */
	@HttpCode(HttpStatus.OK)
	@Post('/request-change-email')
	@UseValidationPipe({ whitelist: true })
	async requestChangeEmail(@Body() entity: ResetEmailRequestDTO, @LanguageDecorator() languageCode: LanguagesEnum) {
		return await this.emailResetService.requestChangeEmail(entity, languageCode);
	}

	/**
	 * Verify email reset request
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Post('/verify-change-email')
	@UseValidationPipe({ whitelist: true })
	async verifyChangeEmail(@Body() entity: VerifyEmailResetRequestDTO) {
		return await this.emailResetService.verifyCode(entity);
	}
}
