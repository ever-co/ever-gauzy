import { Public } from '@gauzy/common';
import {
    BadRequestException,
    Body,
    ClassSerializerInterceptor,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    UseInterceptors,
    UsePipes,
    ValidationPipe
} from '@nestjs/common';
import { EmailConfirmationService } from './email-confirmation.service';
import { ConfirmEmailDTO } from './dto';
import { ApiOperation } from '@nestjs/swagger';

@Controller('email/verify')
@UseInterceptors(ClassSerializerInterceptor)
export class EmailVerificationController {

    constructor(
        private readonly emailConfirmationService: EmailConfirmationService
    ) {}

    @ApiOperation({ summary: 'Email verification' })
    @HttpCode(HttpStatus.OK)
    @Public()
    @Post()
    @UsePipes(new ValidationPipe({ whitelist: true }))
    public async confirmEmail(
        @Body() body: ConfirmEmailDTO
    ) {
        const user = await this.emailConfirmationService.decodeConfirmationToken(body.token);
        if (!!user) {
            if (!!user.emailVerifiedAt) {
                throw new BadRequestException('Your email is already verified.');
            }
            return await this.emailConfirmationService.confirmEmail(user);
        }
    }

    @ApiOperation({ summary: 'Resend email verification link' })
    @HttpCode(HttpStatus.ACCEPTED)
    @Post('resend-link')
    public async resendConfirmationLink() {
        return await this.emailConfirmationService.resendConfirmationLink();
    }
}