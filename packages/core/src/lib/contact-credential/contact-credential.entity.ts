import { ExportRedacted } from '../export-import/export-redact.decorator';
import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ID, IContactCredential, IOrganizationContact, JsonData } from '@gauzy/contracts';
import { OrganizationContact, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmContactCredentialRepository } from './repository/mikro-orm-contact-credential.repository';

/**
 * The customer-side login of one party.
 *
 * **A contact-scoped login, not a second user system.** A shopper, a supplier's contact, a partner and a
 * candidate all authenticate from outside the platform, and none of them is a member of staff: giving
 * every one of them a `user` row would put them inside the staff login, the staff role evaluation, the
 * employee and team listings and the tenant's user count, and would make a customer indistinguishable
 * from staff in every audit trail. This table is the alternative, and it carries no roles of any kind —
 * buyer authority is the company-account membership's role and its limits, and staff authority stays in
 * `role` / `role_permission`.
 *
 * **What the row may store is the point of the table, and it is a short list.** A hash and never a
 * password; the two single-use tokens in their **hashed** form, so that a database read never yields a
 * usable link; an authenticator secret, encrypted at rest; a display identifier, an outcome flag and
 * three counters. There is no plaintext password column, no token that is also the value that was sent,
 * and no role.
 *
 * **The e-mail is unique per tenant and not per organization.** A login is resolved before an
 * organization is known — the caller has an address and a password and nothing else — so an address that
 * named two rows would leave the resolver choosing one, which is a way to log into the wrong party's
 * account. The stored form is always normalised (trimmed and lower-cased), because the resolver compares
 * what it was given against this column.
 */
@ColumnIndex('UQ_contact_credential_customer', ['customerId'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('UQ_contact_credential_tenant_email', ['tenantId', 'email'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_contact_credential_verification', ['verificationToken'], {
	where: '"verificationToken" IS NOT NULL'
})
@ColumnIndex('IDX_contact_credential_reset', ['resetToken'], { where: '"resetToken" IS NOT NULL' })
@MultiORMEntity('contact_credential', { mikroOrmRepository: () => MikroOrmContactCredentialRepository })
export class ContactCredential extends TenantOrganizationBaseEntity implements IContactCredential {
	/**
	 * The contact this credential authenticates. One credential per contact.
	 *
	 * Cascades, because a credential has no independent life: a login for a party that no longer exists
	 * authenticates nobody and cannot be resolved by anyone.
	 */
	@ApiProperty({ type: () => OrganizationContact })
	@IsUUID()
	@MultiORMManyToOne(() => OrganizationContact, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	customer: IOrganizationContact;

	/** Id of the contact. Unique among live rows, which is the first invariant of the table. */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ContactCredential) => it.customer)
	@MultiORMColumn({ relationId: true })
	customerId: ID;

	/**
	 * The login identifier, stored trimmed and lower-cased.
	 *
	 * Unique per tenant among live rows, because login is resolved before an organization is known.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MinLength(3)
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	email: string;

	/**
	 * The hash produced by the platform's password hasher.
	 *
	 * Never an encoded password and never a reversible value, and never serialised: the entity excludes
	 * it at the projection boundary as well as the service. A plaintext password has no column here and
	 * no path into one.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	// a bcrypt digest — the mask hint would only give an attacker free characters
	@ExportRedacted({ blank: true })
	@MultiORMColumn({ type: 'varchar', length: 255, select: false })
	passwordHash: string;

	/** Whether the address has been confirmed by redeeming its verification token. */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isVerified: boolean;

	/**
	 * The **hashed** e-mail verification token, single use.
	 *
	 * Stored hashed on purpose: the token that reached the contact exists only in the message that
	 * carried it, so a database read never yields a link that works.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	// a bearer token that confirms an address
	@ExportRedacted()
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true, select: false })
	verificationToken?: string;

	/** When the verification token stops being redeemable. Written together with the token, never alone. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	verificationExpiresAt?: Date;

	/** The **hashed** password-reset token, single use. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	// a bearer token that resets a credential
	@ExportRedacted()
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true, select: false })
	resetToken?: string;

	/** When the reset token stops being redeemable. Written together with the token, never alone. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	resetExpiresAt?: Date;

	/** When the last successful authentication happened. Read by the inactivity rules. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	lastLoginAt?: Date;

	/**
	 * Consecutive failed authentications since the last success.
	 *
	 * A counter and not a log: the lockout ladder reads it and a success resets it, and the audit trail
	 * of attempts lives in the activity log where it belongs.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsNumber()
	@MultiORMColumn({ type: 'int', default: 0 })
	failedAttempts: number;

	/**
	 * While this instant is in the future the credential refuses every login, whatever the password.
	 *
	 * Evaluated **before** the password is verified, so a locked credential answers in constant time and
	 * the refusal cannot be used to probe which passwords are close.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	lockedUntil?: Date;

	/**
	 * The enrolled authenticator secret, encrypted at rest by the service.
	 *
	 * Excluded from selection by default, so a read that forgets to project still cannot return it.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	// a TOTP seed, which is a standing second factor
	@ExportRedacted()
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true, select: false })
	mfaSecret?: string;

	/**
	 * Tenant-defined extras.
	 *
	 * Never a place for a secret: the recovery codes live here as hashes with a used flag, exactly as
	 * the credential's own secrets are stored hashed, so a leaked row yields nothing usable.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}
