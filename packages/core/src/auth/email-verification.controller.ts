import {
    BadRequestException,
    Body,
    ClassSerializerInterceptor,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    UseGuards,
    UseInterceptors,
    UsePipes,
    ValidationPipe
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Public } from '@gauzy/common';
import { FeatureEnum } from '@gauzy/contracts';
import { EmailConfirmationService } from './email-confirmation.service';
import { FeatureFlagGuard } from './../shared/guards';
import { FeatureFlag } from './../shared/decorators';
import { ConfirmEmailDTO, ConfirmInviteCodeDTO } from './dto';

@Controller('email/verify')
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_EMAIL_VERIFICATION)
@UseInterceptors(ClassSerializerInterceptor)
export class EmailVerificationController {

    constructor(
        private readonly emailConfirmationService: EmailConfirmationService
    ) {}

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
    @UsePipes(new ValidationPipe({ whitelist: true }))
    public async confirmEmail(
        @Body() body: ConfirmEmailDTO
    ): Promise<Object> {
        const user = await this.emailConfirmationService.decodeConfirmationToken(body.token);
        if (!!user) {
            if (!!user.emailVerifiedAt) {
                throw new BadRequestException('Your email is already verified.');
            }
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
    @UsePipes(new ValidationPipe({ whitelist: true }))
    public async confirmEmailByCode(
        @Body() body: ConfirmInviteCodeDTO
    ): Promise<Object> {
        const user = await this.emailConfirmationService.confirmationByCode(body);
        if (!!user) {
            if (!!user.emailVerifiedAt) {
                throw new BadRequestException('Your email is already verified.');
            }
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
    public async resendConfirmationLink(): Promise<Object> {
        return await this.emailConfirmationService.resendConfirmationLink();
    }
}