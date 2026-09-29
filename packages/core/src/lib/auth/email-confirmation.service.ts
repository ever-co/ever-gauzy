import {
	BadRequestException,
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	ServiceUnavailableException
} from '@nestjs/common';
import { MoreThanOrEqual } from 'typeorm';
import { environment } from '@gauzy/config';
import { JwtPayload, sign, verify } from 'jsonwebtoken';
import * as moment from 'moment';
import { IAppIntegrationConfig } from '@gauzy/common';
import {
	FeatureEnum,
	IBasePerTenantEntityModel,
	IUser,
	IUserCodeInput,
	IUserEmailInput,
	IUserTokenInput,
	IVerificationTokenPayload
} from '@gauzy/contracts';
import { deepMerge, generateAlphaNumericCode } from '@gauzy/utils';
import { RequestContext } from './../core/context/request-context';
import { EmailService } from './../email-send/email.service';
import { UserService } from './../user/user.service';
import { FeatureService } from './../feature/feature.service';
import { PasswordHashService } from '../password-hash/password-hash.service';
import { JWT_ALGORITHMS } from './purpose-token';
import { describeEmailSendError } from './../email-send/email-send-error';
import { allowedEmailLinkOrigins, isAllowedEmailLink, isEmailLinkCheckDisabled } from './email-link-origin';

@Injectable()
export class EmailConfirmationService {
	private readonly logger = new Logger(EmailConfirmationService.name);

	constructor(
		private readonly emailService: EmailService,
		private readonly userService: UserService,
		private readonly featureFlagService: FeatureService,
		private readonly passwordHashService: PasswordHashService
	) {}

	/**
	 * Sends an email verification link and code to the user.
	 *
	 * @param user The user to send the verification email to.
	 * @param integration Configuration for app integration.
	 */
	public async sendEmailVerification(user: IUser, integration: IAppIntegrationConfig): Promise<boolean> {
		if (!(await this.featureFlagService.isFeatureEnabled(FeatureEnum.FEATURE_EMAIL_VERIFICATION))) {
			return false;
		}

		try {
			const { id, email } = user;
			const payload: IVerificationTokenPayload = { id, email };

			// Generate a JWT token for email verification
			const token = sign(payload, environment.JWT_VERIFICATION_TOKEN_SECRET, {
				expiresIn: `${environment.JWT_VERIFICATION_TOKEN_EXPIRATION_TIME}s`
			});

			// Override the default config by merging in the provided values - except a confirmation
			// link on a host this deployment does not serve (see email-link-origin.ts).
			const appIntegration = deepMerge(environment.appIntegrationConfig, this.withTrustedLinks(integration, id));

			// The address is encoded: a raw `+` (plus addressing) reads back as a space, and the
			// confirm request then fails e-mail validation, so those users could never verify by link.
			const verificationLink = `${appIntegration.appEmailConfirmationUrl}?email=${encodeURIComponent(
				email
			)}&token=${token}`;
			const verificationCode = generateAlphaNumericCode();

			// Update user's email token field and verification code
			// Always set codeExpireAt — default to 7 days to match the environment module default
			const verificationExpiry = environment.JWT_VERIFICATION_TOKEN_EXPIRATION_TIME || 86400 * 7;
			await this.userService.update(id, {
				emailToken: await this.passwordHashService.hash(token),
				code: verificationCode,
				codeExpireAt: moment(new Date()).add(verificationExpiry, 'seconds').toDate()
			});

			// Send email verification link. Resolves false when the provider did not take the message;
			// the send itself is logged and recorded in email_sent by EmailService.
			return await this.emailService.emailVerification(user, verificationLink, verificationCode, appIntegration);
		} catch (error) {
			this.logger.error(
				`Error while preparing the verification email for user ${user?.id}: ${describeEmailSendError(error)}`
			);
			return false;
		}
	}

	/**
	 * Resend confirmation email link
	 *
	 * Rate limited by the controller. Reports a send the provider refused as 503, so the caller can
	 * tell the user to try again instead of promising an email that is not coming.
	 */
	public async resendConfirmationLink(config: IAppIntegrationConfig) {
		if (!(await this.featureFlagService.isFeatureEnabled(FeatureEnum.FEATURE_EMAIL_VERIFICATION))) {
			return;
		}
		try {
			const user = await this.userService.getIfExists(RequestContext.currentUserId());
			if (!!user.emailVerifiedAt) {
				throw new BadRequestException('Your email is already verified.');
			}
			const sent = await this.sendEmailVerification(user, config);
			if (!sent) {
				throw new ServiceUnavailableException(
					'We could not send the verification email right now. Please try again in a few minutes.'
				);
			}
			return new Object({
				status: HttpStatus.OK,
				message: `OK`
			});
		} catch (error) {
			if (error instanceof HttpException) {
				throw error;
			}
			throw new BadRequestException(error?.message);
		}
	}

	/**
	 * Whether the signed-in user has verified their email.
	 *
	 * @returns `{ isEmailVerified }` for the current user; false when the user cannot be found.
	 */
	public async getVerificationStatus(): Promise<{ isEmailVerified: boolean }> {
		const user = await this.userService.getIfExists(RequestContext.currentUserId());
		return { isEmailVerified: !!user?.emailVerifiedAt };
	}

	/**
	 * The caller's integration overrides, minus a confirmation link on an origin this deployment does
	 * not serve. See {@link allowedEmailLinkOrigins} for why.
	 *
	 * @param integration The overrides supplied with the request.
	 * @param userId Only for the log line.
	 */
	private withTrustedLinks(integration: IAppIntegrationConfig, userId: string): IAppIntegrationConfig {
		if (!integration?.appEmailConfirmationUrl || isEmailLinkCheckDisabled()) {
			return integration;
		}
		if (isAllowedEmailLink(integration.appEmailConfirmationUrl, allowedEmailLinkOrigins())) {
			return integration;
		}

		this.logger.warn(
			`Ignoring appEmailConfirmationUrl for user ${userId}: its origin is not one this deployment serves ` +
				`(add it to EMAIL_LINK_ALLOWED_ORIGINS if it should be).`
		);
		return Object.fromEntries(
			Object.entries(integration).filter(([key]) => key !== 'appEmailConfirmationUrl')
		) as IAppIntegrationConfig;
	}

	/**
	 * Decode email confirmation token
	 *
	 * @param token
	 * @returns
	 */
	public async decodeConfirmationToken(token: IUserTokenInput['token']): Promise<IUser> {
		if (!(await this.featureFlagService.isFeatureEnabled(FeatureEnum.FEATURE_EMAIL_VERIFICATION))) {
			return;
		}
		try {
			const payload: JwtPayload | string = verify(token, environment.JWT_VERIFICATION_TOKEN_SECRET, {
				algorithms: JWT_ALGORITHMS
			});

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
				if (!!user.emailToken && !!(await this.passwordHashService.verify(token, user.emailToken))) {
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
		if (!(await this.featureFlagService.isFeatureEnabled(FeatureEnum.FEATURE_EMAIL_VERIFICATION))) {
			return;
		}

		try {
			const { email, code, tenantId } = payload;
			if (email && code && tenantId) {
				const user = await this.userService.findOneByOptions({
					where: {
						email,
						code,
						tenantId,
						codeExpireAt: MoreThanOrEqual(new Date())
					}
				});
				if (!!user.emailVerifiedAt) {
					throw new BadRequestException('Your email is already verified.');
				}

				// Atomically invalidate the verification code (prevent reuse / TOCTOU race) // cspell:ignore TOCTOU
				// The claim scopes by id AND code AND expiry, so a concurrent request that already
				// nullified the code matches zero rows. Scoping by id alone — as this did until now,
				// despite the comment claiming otherwise — is not a claim at all: both racers matched
				// their own row and both confirmed off one code.
				const claimed = await this.userService.claimEmailVerificationCode(user['id'], code, tenantId);

				if (!claimed) {
					throw new BadRequestException('Failed to verify email.');
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
		if (!(await this.featureFlagService.isFeatureEnabled(FeatureEnum.FEATURE_EMAIL_VERIFICATION))) {
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
