import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	UseGuards,
	UseInterceptors
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { FeatureFlag, IAppIntegrationConfig, Public } from '@gauzy/common';
import { FeatureEnum } from '@gauzy/contracts';
import { EmailConfirmationService } from './email-confirmation.service';
import { FeatureFlagGuard } from './../shared/guards';
import { UseValidationPipe } from '../shared/pipes';
import { ConfirmEmailByCodeDTO, ConfirmEmailByTokenDTO } from './dto';

@Controller('email/verify')
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_EMAIL_VERIFICATION)
@UseInterceptors(ClassSerializerInterceptor)
export class EmailVerificationController {
	constructor(private readonly emailConfirmationService: EmailConfirmationService) { }

	/**
	 * Email verification by token
	 *
	 * @param body
	 * @returns
	 */
	@ApiOperation({ summary: 'Email verification by token' })
	@HttpCode(HttpStatus.OK)
	@Public()
	@Post()
	@UseValidationPipe({ whitelist: true })
	public async confirmEmail(@Body() body: ConfirmEmailByTokenDTO): Promise<Object> {
		const user = await this.emailConfirmationService.decodeConfirmationToken(body.token);
		if (!!user) {
			return await this.emailConfirmationService.confirmEmail(user);
		}
	}

	/**
	 * Email verification by token
	 *
	 * @param body
	 * @returns
	 */
	@ApiOperation({ summary: 'Email verification by code' })
	@HttpCode(HttpStatus.OK)
	@Public()
	@Post('code')
	@UseValidationPipe({ whitelist: true })
	public async confirmEmailByCode(@Body() body: ConfirmEmailByCodeDTO): Promise<Object> {
		const user = await this.emailConfirmationService.confirmationByCode(body);
		if (!!user) {
			return await this.emailConfirmationService.confirmEmail(user);
		}
	}

	/**
	 * Resend email verification link
	 *
	 * @returns
	 */
	@ApiOperation({ summary: 'Resend email verification link' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Post('resend-link')
	public async resendConfirmationLink(@Body() config: IAppIntegrationConfig): Promise<Object> {
		return await this.emailConfirmationService.resendConfirmationLink(config);
	}
}
