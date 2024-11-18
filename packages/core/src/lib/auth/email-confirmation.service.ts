import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { IsNull, MoreThanOrEqual } from 'typeorm';
import { environment } from '@gauzy/config';
import { deepMerge, IAppIntegrationConfig } from '@gauzy/common';
import { FeatureEnum, IBasePerTenantEntityModel, IUser, IUserCodeInput, IUserEmailInput, IUserTokenInput, IVerificationTokenPayload } from '@gauzy/contracts';
import { JwtPayload, sign, verify } from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import moment from 'moment';
import { ALPHA_NUMERIC_CODE_LENGTH } from './../constants';
import { EmailService } from './../email-send/email.service';
import { UserService } from './../user/user.service';
import { FeatureService } from './../feature/feature.service';
import { RequestContext } from './../core/context';
import { generateRandomAlphaNumericCode } from './../core/utils';

@Injectable()
export class EmailConfirmationService {

    constructor(
        private readonly emailService: EmailService,
        private readonly userService: UserService,
        private readonly featureFlagService: FeatureService
    ) { }

    /**
     * Sends an email verification link and code to the user.
     *
     * @param user The user to send the verification email to.
     * @param integration Configuration for app integration.
     */
    public async sendEmailVerification(user: IUser, integration: IAppIntegrationConfig) {
        if (!await this.featureFlagService.isFeatureEnabled(
            FeatureEnum.FEATURE_EMAIL_VERIFICATION
        )) {
            return;
        }

        try {
            const { id, email } = user;
            const payload: IVerificationTokenPayload = { id, email };

            // Generate a JWT token for email verification
            const token = sign(payload, environment.JWT_VERIFICATION_TOKEN_SECRET, {
                expiresIn: `${environment.JWT_VERIFICATION_TOKEN_EXPIRATION_TIME}s`
            });

            // Override the default config by merging in the provided values.
            const appIntegration = deepMerge(environment.appIntegrationConfig, integration);

            const verificationLink = `${appIntegration.appEmailConfirmationUrl}?email=${email}&token=${token}`;
            const verificationCode = generateRandomAlphaNumericCode(ALPHA_NUMERIC_CODE_LENGTH);

            // Update user's email token field and verification code
            await this.userService.update(id, {
                emailToken: await bcrypt.hash(token, 10),
                code: verificationCode,
                ...(environment.JWT_VERIFICATION_TOKEN_EXPIRATION_TIME ? {
                    codeExpireAt: moment(new Date()).add(environment.JWT_VERIFICATION_TOKEN_EXPIRATION_TIME, 'seconds').toDate()
                } : {}),
            });

            // Send email verification link
            return await this.emailService.emailVerification(
                user,
                verificationLink,
                verificationCode,
                appIntegration
            );
        } catch (error) {
            console.log(error, 'Error while sending verification email');
        }
    }

    /**
     * Resend confirmation email link
     *
     */
    public async resendConfirmationLink(config: IAppIntegrationConfig) {
        if (!await this.featureFlagService.isFeatureEnabled(
            FeatureEnum.FEATURE_EMAIL_VERIFICATION
        )) {
            return;
        }
        try {
            const user = await this.userService.getIfExists(
                RequestContext.currentUserId()
            );
            if (!!user.emailVerifiedAt) {
                throw new BadRequestException('Your email is already verified.');
            }
            await this.sendEmailVerification(user, config);
            return new Object({
                status: HttpStatus.OK,
                message: `OK`
            });
        } catch (error) {
            throw new BadRequestException(error?.message);
        }
    }

    /**
     * Decode email confirmation token
     *
     * @param token
     * @returns
     */
    public async decodeConfirmationToken(token: IUserTokenInput['token']): Promise<IUser> {
        if (!await this.featureFlagService.isFeatureEnabled(
            FeatureEnum.FEATURE_EMAIL_VERIFICATION
        )) {
            return;
        }
        try {
            const payload: JwtPayload | string = verify(token, environment.JWT_VERIFICATION_TOKEN_SECRET);

            if (typeof payload === 'object' && 'email' in payload && 'id' in payload) {
                const { id, email } = payload;
                const user = await this.userService.findOneByOptions({
                    where: {
                        id,
                        email
                    }
                });
                if (!!user.emailVerifiedAt) {
                    throw new BadRequestException('Your email is already verified.');
                }
                if (!!user.emailToken && !!(await bcrypt.compare(token, user.emailToken))) {
                    return user;
                }
            }
            throw new BadRequestException('Failed to verify email.');
        } catch (error) {
            if (error?.name === 'TokenExpiredError') {
                throw new BadRequestException('JWT token has been expired.');
            }
            throw new BadRequestException(error?.message);
        }
    }

    /**
     * Email confirmation by code
     *
     * @param payload
     * @returns
     */
    public async confirmationByCode(
        payload: IUserEmailInput & IUserCodeInput & IBasePerTenantEntityModel
    ): Promise<IUser> {
        if (!await this.featureFlagService.isFeatureEnabled(
            FeatureEnum.FEATURE_EMAIL_VERIFICATION
        )) {
            return;
        }

        try {
            const { email, code, tenantId } = payload;
            if (email && code) {
                const user = await this.userService.findOneByOptions({
                    where: [
                        {
                            email,
                            code,
                            tenantId,
                            codeExpireAt: MoreThanOrEqual(new Date())
                        },
                        {
                            email,
                            code,
                            tenantId,
                            codeExpireAt: IsNull()
                        }
                    ]
                });
                if (!!user.emailVerifiedAt) {
                    throw new BadRequestException('Your email is already verified.');
                }
                return user;
            }
            throw new BadRequestException('Failed to verify email.');
        } catch (error) {
            throw new BadRequestException('Failed to verify email.');
        }
    }

    /**
     * Confirm user email
     *
     * @param user
     */
    public async confirmEmail(user: IUser) {
        if (!await this.featureFlagService.isFeatureEnabled(
            FeatureEnum.FEATURE_EMAIL_VERIFICATION
        )) {
            return;
        }
        try {
            await this.userService.markEmailAsVerified(user['id']);
        } finally {
            return new Object({
                status: HttpStatus.OK,
                message: `OK`
            });
        }
    }
}
