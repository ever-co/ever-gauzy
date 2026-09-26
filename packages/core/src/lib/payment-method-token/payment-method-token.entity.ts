import { ExportRedacted } from '../export-import/export-redact.decorator';
import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import {
	ID,
	IPaymentAccountHolder,
	IPaymentMethodToken,
	JsonData,
	PaymentMethodTokenStatus,
	PaymentMethodTokenType
} from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { PaymentAccountHolder } from '../payment-account-holder/payment-account-holder.entity';
import { MikroOrmPaymentMethodTokenRepository } from './repository/mikro-orm-payment-method-token.repository';

/**
 * A saved instrument belonging to an account holder: the reference the platform may charge again, plus
 * the display facts needed to show it to the party that saved it.
 *
 * **Hard rule: `token` is a provider-issued reference and never card data.** The platform stores no
 * primary account number, no verification value, no full bank account number and no track or chip
 * data — there is no column for any of them here, and none may be added. The provider's hosted vault
 * holds the instrument; the platform holds a token that is meaningless outside a call to that provider
 * with the tenant's own credentials. This is not a policy a migration could relax later: a stored
 * account number would have to be encrypted, rotated, key-managed, audited and rendered out of every
 * export, and the platform deliberately has none of that.
 *
 * The only way a row exists is that the provider issued a token against its own client-side flow and
 * the platform then **confirmed it with the provider** before persisting it. That is why the creation
 * path takes the provider's own answer as a required argument rather than a bare string: a reference
 * that no provider ever returned cannot be written, because there is nothing to confirm it against.
 *
 * The row is kept when the instrument is removed. Revocation is the only removal path there is: a
 * charge history that points at a missing instrument is unauditable, and re-adding a removed
 * instrument writes a new row, which is exactly what the uniqueness rule's `REVOKED` predicate permits.
 */
@ColumnIndex('UQ_payment_method_token_provider_token', ['providerKey', 'token'], {
	unique: true,
	where: '"status" <> \'REVOKED\' AND "deletedAt" IS NULL'
})
@ColumnIndex('UQ_payment_method_token_default', ['accountHolderId', 'type'], {
	unique: true,
	where: '"isDefault" = true AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_payment_method_token_holder', ['accountHolderId', 'status', 'type'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_payment_method_token_provider', ['paymentProviderId'], {
	where: '"paymentProviderId" IS NOT NULL'
})
@ColumnIndex('IDX_payment_method_token_address', ['billingAddressId'], {
	where: '"billingAddressId" IS NOT NULL'
})
// `IDX_payment_method_token_expiry` deliberately does not lead with `organizationId`: the expiry sweep
// is a global scheduled pass rather than an organization-scoped read, and leading with the tenant would
// make it unusable. Every request-time read of an instrument leads with `accountHolderId` through
// `IDX_payment_method_token_holder`, or is a single probe of the default rule's index.
//
// `UQ_payment_method_token_default` is guarded by a **boolean**, so MySQL has no generated-column form
// for it and the dialect gets no index at all: the rule is enforced by `PaymentMethodTokenService`
// inside the writing transaction — setting a new default clears the previous one under a row lock on
// the holder — and re-reported nightly by the schema audit, exactly as the schema chapter prescribes.
@MultiORMEntity('payment_method_token', { mikroOrmRepository: () => MikroOrmPaymentMethodTokenRepository })
export class PaymentMethodToken extends TenantOrganizationBaseEntity implements IPaymentMethodToken {
	/**
	 * The account at the provider this instrument belongs to.
	 *
	 * An instrument has no meaning without its account, so the relationship cascades: removing an account
	 * removes its instruments. The softer path — disabling the account — revokes them instead, in the
	 * same transaction, and keeps the rows.
	 */
	@ApiProperty({ type: () => PaymentAccountHolder })
	@MultiORMManyToOne(() => PaymentAccountHolder, (holder) => holder.methodTokens, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	accountHolder?: IPaymentAccountHolder;

	/**
	 * Id of the account at the provider. The leading column of every request-time read of an instrument.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: PaymentMethodToken) => it.accountHolder)
	@MultiORMColumn({ type: 'uuid', relationId: true })
	accountHolderId: ID;

	/**
	 * The provider registration, duplicated from the holder for the join.
	 *
	 * **A plain identifier, and deliberately not a relation object.** The provider registry is a table
	 * the payment capability owns, and a kernel entity cannot import a package's entity class. The
	 * kernel migration creates the column **without** its foreign key, and the constraint is added by
	 * that capability's own `AddPaymentDomainForeignKeys` migration — this platform's rule that a
	 * constraint is added where its target is created. The service keeps the value equal to the holder's,
	 * because a token can never be moved to another provider than its holder's.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	paymentProviderId?: ID;

	/**
	 * The provider's stable key. Must equal the holder's, and the service checks rather than trusts it.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64 })
	providerKey: string;

	/**
	 * The provider's tokenised reference.
	 *
	 * Never a primary account number, never a verification value, never a bank account number — see the
	 * class note. Unique per provider key among live and non-revoked rows, so the same instrument cannot
	 * be saved twice and defaulted twice, while re-adding a removed instrument legitimately writes a new
	 * row.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	// the stored instrument reference a charge is made with
	@ExportRedacted()
	@MultiORMColumn({ type: 'varchar', length: 255 })
	token: string;

	/**
	 * What kind of instrument this is.
	 *
	 * It decides three behaviours the service branches on: which display facts are required, whether the
	 * instrument participates in the default rule of its holder, and whether a mandate is required
	 * before an off-session charge.
	 */
	@ApiProperty({ type: () => String, enum: PaymentMethodTokenType, default: PaymentMethodTokenType.CARD })
	@IsEnum(PaymentMethodTokenType)
	@MultiORMColumn({ type: 'simple-enum', enum: PaymentMethodTokenType, default: PaymentMethodTokenType.CARD })
	type: PaymentMethodTokenType;

	/**
	 * The provider's brand label for the instrument, exactly as the provider reports it. Display only;
	 * never used to route a charge.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	brand?: string;

	/**
	 * The last four digits the provider returns, for display on the party's own instrument list. Null for
	 * a wallet, or for a provider that returns no display digits.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 4 })
	@IsOptional()
	@IsString()
	@MaxLength(4)
	@MultiORMColumn({ type: 'varchar', length: 4, nullable: true })
	last4?: string;

	/**
	 * 1–12. Null when the instrument does not expire (a bank account, a wallet) or when the provider does
	 * not disclose it.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 12 })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(12)
	@MultiORMColumn({ type: 'int', nullable: true })
	expiryMonth?: number;

	/**
	 * Four digits. Together with `expiryMonth` it feeds the expiry sweep and the expiry refusal; the pair
	 * is never authoritative for the provider's own decision, because a provider may reject an apparently
	 * valid card.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', nullable: true })
	expiryYear?: number;

	/**
	 * The name on the instrument as the provider reports it, for display on the party's own list.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	holderName?: string;

	/**
	 * The address the instrument bills to, from the address book.
	 *
	 * **A plain identifier rather than a relation object.** The address book is a core table owned by the
	 * module that declares it, and that module is not this one: a relation here would import an entity
	 * class this module cannot depend on. The migration creates the column and the constraint together
	 * **where the address table is present**, which is this platform's rule for a reference into a table
	 * another set creates. The address is snapshotted into a charge attempt when one is made, so editing
	 * or deleting an address never changes what a past authorisation used.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	billingAddressId?: ID;

	/**
	 * The instrument used when a caller names none, and the one a renewal charges. At most one per
	 * `(accountHolderId, type)`, and only an `ACTIVE` instrument may hold it.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isDefault: boolean;

	/**
	 * Whether the instrument may be charged. Only `ACTIVE` is chargeable; `FAILED` is recoverable by a
	 * successful charge, while `EXPIRED` and `REVOKED` are terminal and are never reactivated.
	 */
	@ApiProperty({ type: () => String, enum: PaymentMethodTokenStatus, default: PaymentMethodTokenStatus.ACTIVE })
	@IsEnum(PaymentMethodTokenStatus)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PaymentMethodTokenStatus,
		default: PaymentMethodTokenStatus.ACTIVE
	})
	status: PaymentMethodTokenStatus;

	/**
	 * Stamped on every authorisation attempt that reached the provider, successful or not, so "which
	 * instrument was tried" is answerable from the token row and the party's list can be ordered by use.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	lastUsedAt?: Date;

	/**
	 * Non-null exactly when the status is `REVOKED`. The row is kept, because a charge history that
	 * points at a missing instrument is unauditable, and revocation is idempotent.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	revokedAt?: Date;

	/**
	 * The provider fragment — fingerprint, issuer, wallet type, step-up-authentication capability — plus
	 * the decline bookkeeping: the consecutive-decline counter, the last decline code and when it
	 * happened.
	 *
	 * The counter is a **cache**, re-derived from the failed authorisations of the holder by the nightly
	 * instrument audit, and never a source of truth.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}
