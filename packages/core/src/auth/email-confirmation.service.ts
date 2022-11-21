
import { Injectable } from '@nestjs/common';
import { ConfigService, environment } from '@gauzy/config';
import { IUser, IVerificationTokenPayload } from '@gauzy/contracts';
import { sign } from 'jsonwebtoken';
import { EmailService } from './../email/email.service';
import { UserService } from './../user/user.service';

@Injectable()
export class EmailConfirmationService {

    constructor(
        private readonly configService: ConfigService,
        private readonly emailService: EmailService,
        private readonly userService: UserService
    ) {}

    /**
     * Send confirmation email link
     *
     * @param user
     * @returns
     */
    public async sendVerificationLink(user: IUser) {
        try {
            const { id, email } = user;
            const payload: IVerificationTokenPayload = { id, email };

            const token = sign(payload, environment.JWT_VERIFICATION_TOKEN_SECRET, {
                expiresIn: `${environment.JWT_VERIFICATION_TOKEN_EXPIRATION_TIME}s`
            });
            const url = `${this.configService.get('EMAIL_CONFIRMATION_URL')}?email=${email}&token=${token}`;

            // update email token field for user
            await this.userService.update(id, {
                emailToken: token
            });
            // send email verfication link
            return this.emailService.emailVerification(user, url);
        } catch (error) {
            console.log(error, 'Error while sending verification email');
        }
    }
}