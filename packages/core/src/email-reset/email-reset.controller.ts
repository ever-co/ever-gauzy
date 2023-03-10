import {
	Controller,
	HttpCode,
	HttpStatus,
	UseGuards,
	Post,
	Body,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { EmailResetService } from './email-reset.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ResetEmailRequestDTO, VerifyEmailResetRequestDTO } from './dto';

@ApiBearerAuth()
@Controller('email-reset')
export class EmailResetController {
	constructor(private readonly emailResetService: EmailResetService) {}

	@HttpCode(HttpStatus.CREATED)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_EDIT, PermissionsEnum.PROFILE_EDIT)
	@Post('/request-change-email')
	@UsePipes(new ValidationPipe())
	async requestChangeEmail(
		@Body() entity: ResetEmailRequestDTO,
		@LanguageDecorator() languageCode: LanguagesEnum
	) {
		return await this.emailResetService.requestChangeEmail(
			entity,
			languageCode
		);
	}

	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_EDIT, PermissionsEnum.PROFILE_EDIT)
	@Post('/verify-change-email')
	@UsePipes(new ValidationPipe())
	async verifyChangeEmail(@Body() entity: VerifyEmailResetRequestDTO) {
		return await this.emailResetService.verifyCode(entity);
	}
}
