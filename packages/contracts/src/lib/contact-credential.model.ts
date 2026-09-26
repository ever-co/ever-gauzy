import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';

/**
 * What a credential row may be read as.
 *
 * The secrets are **not members of this shape at all**, rather than members that happen to be null:
 * a field a client can never legitimately read is a schema omission, and leaving it out of the type is
 * what makes "the hash never leaves the service" a property of the code rather than of a convention a
 * projection can forget. The hash, the MFA secret and the two token columns are therefore absent here
 * and are stripped by the service before a row is answered.
 */
export interface IContactCredentialPublic extends IBasePerTenantAndOrganizationEntityModel {
	/** The contact the credential authenticates. */
	customerId: ID;
	/** The login identifier, always stored normalised. */
	email: string;
	/** Whether the verification token has been redeemed. */
	isVerified: boolean;
	/** When the contact last authenticated successfully. */
	lastLoginAt?: Date;
	/** The instant the credential stops refusing logins, when it is locked. */
	lockedUntil?: Date;
	/** Whether an authenticator factor has been enrolled. The secret itself is never read out. */
	hasMfa: boolean;
}

/**
 * The columns of one contact login — the customer-side identity of a party that is not a member of
 * staff.
 *
 * **What the row may store is the point of the table.** It holds a hash and never a password, it holds
 * the two single-use tokens in their hashed form and never a usable link, and it holds no roles, no
 * membership and no employee link: buyer authority is the `contact_buyer` role plus its spending
 * limits, and staff authority stays in `role` / `role_permission`. Giving a contact a `user` row would
 * put a shopper inside the staff login, the staff role evaluation and the tenant's user count.
 */
export interface IContactCredential extends IBasePerTenantAndOrganizationEntityModel {
	/** The contact this credential authenticates. One credential per contact. */
	customerId: ID;
	/** The login identifier. Unique per tenant, because login is resolved before an organization is known. */
	email: string;
	/** The hash produced by the platform's password hasher. Never an encoded password, never a reversible value. */
	passwordHash: string;
	/** Whether the e-mail address has been confirmed by redeeming its verification token. */
	isVerified: boolean;
	/**
	 * The **hashed** e-mail verification token, single use.
	 *
	 * A database read never yields a usable token, which is why the plaintext is not what is written
	 * here; the token that reached the contact exists only in the message that carried it.
	 */
	verificationToken?: string;
	/** When the verification token stops being redeemable. Written together with the token. */
	verificationExpiresAt?: Date;
	/** The **hashed** password-reset token, single use. */
	resetToken?: string;
	/** When the reset token stops being redeemable. Written together with the token. */
	resetExpiresAt?: Date;
	/** When the last successful authentication happened. */
	lastLoginAt?: Date;
	/** Consecutive failed authentications since the last success. Reset on success. */
	failedAttempts: number;
	/** While this instant is in the future the credential refuses every login, whatever the password. */
	lockedUntil?: Date;
	/** The enrolled authenticator secret, encrypted at rest. Absent until a factor is enrolled. */
	mfaSecret?: string;
	/** Tenant-defined extras. Never a place for a secret, and never a place for the recovery codes' plaintext. */
	metadata?: JsonData;
}

/**
 * What a caller states when a contact credential is created.
 *
 * There is no `password` member and there never will be: the hash is produced by the platform's
 * password hasher before this row is written, and a service that accepted a plaintext would be one
 * log line away from recording it. A body that carries one is refused rather than ignored.
 */
export interface IContactCredentialCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	/** The contact the credential authenticates. */
	customerId: ID;
	/** The login identifier. Stored trimmed and lower-cased. */
	email: string;
	/** The hash produced by the password hasher. */
	passwordHash: string;
	/** Whether the address is already confirmed. Defaults to false, and a registration never states true. */
	isVerified?: boolean;
	/** Tenant-defined extras. */
	metadata?: JsonData;
}

/**
 * What a caller may change on an existing credential.
 *
 * The contact it authenticates is not among them — a credential does not move between contacts, and
 * giving it a new owner would silently transfer a login. The two tokens and the lockout counters move
 * through the operations that observe them.
 */
export interface IContactCredentialUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	/** The login identifier, restated. Stored trimmed and lower-cased, and refused when another live credential holds it. */
	email?: string;
	/** Tenant-defined extras. */
	metadata?: JsonData;
}

/** A single-use token and the instant it stops being redeemable. */
export interface IContactCredentialTokenInput {
	/** The **hashed** token. The plaintext exists only in the message that carried it. */
	token: string;
	/** When the token lapses. Must be in the future. */
	expiresAt: Date;
}

/** The completion of a password reset: the token that authorised it and the hash it produced. */
export interface IContactCredentialResetInput extends IContactCredentialTokenInput {
	/** The **hashed** new password, already produced by the password hasher. */
	passwordHash: string;
}

/**
 * The lockout ladder, stated once so that it is one policy rather than a set of literals.
 *
 * The counter is per credential and never per address, so a shared office address is never locked out;
 * address-level abuse is the rate limiter's business.
 */
export interface IContactLockoutPolicy {
	/** Consecutive failures that arm the lock. */
	threshold: number;
	/** How long the armed lock lasts. */
	durationMinutes: number;
	/** How long a further failure *while already locked* extends the lock to. */
	extensionMinutes: number;
	/** The ceiling a lock may never pass, however many failures arrive. */
	maxHours: number;
}

/** The default lockout ladder: five failures arm a fifteen-minute lock, extended to thirty minutes by a further failure, and never beyond a day. */
export const CONTACT_LOCKOUT_POLICY: IContactLockoutPolicy = {
	threshold: 5,
	durationMinutes: 15,
	extensionMinutes: 30,
	maxHours: 24
};

/** The fields a caller may narrow a lookup of credentials by. */
export interface IContactCredentialFindInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Restrict to the credential of one contact. */
	customerId?: ID;
	/** Restrict to one login identifier, matched on the stored normalised form. */
	email?: string;
	/** Restrict to confirmed or to unconfirmed credentials. */
	isVerified?: boolean;
}
