import { Controller, HttpCode, HttpStatus, UseGuards, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { EmailResetService } from './email-reset.service';
import { ResetEmailRequestDTO, VerifyEmailResetRequestDTO } from './dto';

@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_USERS_EDIT, PermissionsEnum.PROFILE_EDIT)
@Controller('email-reset')
export class EmailResetController {
	constructor(private readonly emailResetService: EmailResetService) {}

	/**
	 * Create email reset request.
	 *
	 * @param entity
	 * @param languageCode
	 * @returns
	 */
	@HttpCode(HttpStatus.OK)
	@Post('/request-change-email')
	@UsePipes(new ValidationPipe({ whitelist: true }))
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
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async verifyChangeEmail(@Body() entity: VerifyEmailResetRequestDTO) {
		return await this.emailResetService.verifyCode(entity);
	}
}
