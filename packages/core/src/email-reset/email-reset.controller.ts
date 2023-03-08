import { Controller, HttpCode, HttpStatus, UseGuards, Post, Body } from '@nestjs/common';
import { LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { UserEmailDTO } from '../user/dto';
import { EmailResetService } from './email-reset.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { VerifyEmailResetRequestDTO } from './dto/verify-email-reset-request.dto';

@ApiBearerAuth()
@Controller('email-reset')
export class EmailResetController {
	constructor(private readonly emailResetService: EmailResetService) {}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_EDIT, PermissionsEnum.PROFILE_EDIT)
	@Post('/request-change-email')
	async requestChangeEmail(@Body() entity: UserEmailDTO, @LanguageDecorator() languageCode: LanguagesEnum) {
		return await this.emailResetService.requestChangeEmail(entity, languageCode);
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_EDIT, PermissionsEnum.PROFILE_EDIT)
	@Post('/verify-change-email')
	async verifyChangeEmail(@Body() entity: VerifyEmailResetRequestDTO) {
		return await this.emailResetService.verifyCode(entity);
	}
}
