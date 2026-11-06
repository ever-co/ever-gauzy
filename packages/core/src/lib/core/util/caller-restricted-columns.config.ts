import { PermissionsEnum } from '@gauzy/contracts';

/**
 * Columns a caller may never name in the `where`, `order` or `select` it sends to a list or read route, keyed by
 * entity class name. A filter or a sort on a secret answers, by which rows come back or in which order, what the
 * rows never show. Lookups a service builds itself (sign-in by code, token checks) are not affected.
 */
export const CALLER_REFUSED_COLUMNS: Readonly<Record<string, readonly string[]>> = {
	User: ['hash', 'refreshToken', 'code', 'codeExpireAt', 'emailToken'],
	Invite: ['token', 'code'],
	EmailReset: ['code', 'token', 'expiredAt'],
	PasswordReset: ['token'],
	TenantApiKey: ['apiKey', 'apiSecret'],
	UserApiToken: ['tokenHash'],
	Token: ['tokenHash'],
	AccountDeletionRequest: ['tokenHash'],
	OAuthClient: ['clientSecretHash', 'codeSecret'],
	OrganizationTeamJoinRequest: ['code', 'token', 'expiredAt'],
	ContactCredential: [
		'passwordHash',
		'verificationToken',
		'verificationExpiresAt',
		'resetToken',
		'resetExpiresAt',
		'mfaSecret'
	],
	CustomSmtp: ['password'],
	WebhookSubscription: ['secret'],
	// A share's token reads the shared record without signing in
	SharedEntity: ['token']
};

/**
 * Rate columns a caller may name in `where`, `order` or `select` only while holding {@link RATE_EDITOR_PERMISSION},
 * the right that sets them. Names of columns that are not on an entity yet take effect as soon as they are.
 */
export const RATE_EDITOR_COLUMNS: Readonly<Record<string, readonly string[]>> = {
	Employee: ['payRateValue', 'payRateCurrency'],
	OrganizationProject: ['billRateValue'],
	OrganizationProjectEmployee: ['billRateValue']
};

export const RATE_EDITOR_PERMISSION = PermissionsEnum.ORG_EMPLOYEES_EDIT;
