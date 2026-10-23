import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDate, IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';
import {
	CurrencyCode,
	ID,
	IPaymentAccountHolder,
	IOrganizationContact,
	IPaymentMethodToken,
	JsonData,
	PaymentAccountHolderStatus,
	PaymentAccountHolderType,
	PaymentAccountVerificationStatus
} from '@gauzy/contracts';
import { OrganizationContact, TenantOrganizationBaseEntity } from '../core/entities/internal';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany
} from '../core/decorators/entity';
import { PaymentMethodToken } from '../payment-method-token/payment-method-token.entity';
import { MikroOrmPaymentAccountHolderRepository } from './repository/mikro-orm-payment-account-holder.repository';

/**
 * One party's standing account **at one provider** — the payer the platform remembers.
 *
 * **Why this exists at all.** The platform could take a payment but not remember one: a provider
 * registration, a collection, an attempt, a capture, a refund and a payment all describe a *movement*,
 * and not one of them answers "which account at the provider does this party charge against, and which
 * saved instruments belong to it?". That question is asked by a renewal with nobody present, by a
 * repeat purchase, by any one-click authorisation and by a payout to a seller. A second handshake per
 * charge is not an answer, because at a renewal there is no buyer to hand a secret to; the provider's
 * own reference is the only artefact the platform is allowed to keep. This row is the answer, and it
 * is the anchor an instrument, a mandate and an off-session charge all hang off.
 *
 * **Why it is a core table and not a capability package's table.** The holder is provider
 * infrastructure rather than a buying-transaction concept: an invoice settled by a recurring debit, a
 * recurring service charge, a point-of-sale sale and a marketplace payout are four different domains
 * asking the identical question, so a table one domain owned would have to be redeclared by the next.
 * It therefore lives in the kernel with the rest of the provider-facing model and carries no domain
 * prefix.
 *
 * **The row is never hard-deleted while anything references it.** A saved instrument, a charge attempt,
 * a subscription or a settlement may all point at it, and two of those four live in capability packages
 * whose tables are created later, so no portable constraint can carry the rule at creation time. The
 * supported path is a terminal status plus a soft delete, and the service refuses the hard delete.
 */
@ColumnIndex('UQ_payment_account_holder_provider_account', ['providerKey', 'externalAccountId'], {
	unique: true,
	where: '"externalAccountId" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('UQ_payment_account_holder_active', ['contactId', 'providerKey', 'type'], {
	unique: true,
	where: '"status" = \'ACTIVE\' AND "contactId" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_payment_account_holder_contact', ['organizationId', 'contactId', 'type', 'status'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_payment_account_holder_org_type', ['organizationId', 'type', 'status'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_payment_account_holder_provider', ['paymentProviderId', 'status'], {
	where: '"paymentProviderId" IS NOT NULL'
})
@ColumnIndex('IDX_payment_account_holder_mandate', ['providerKey', 'mandateReference'], {
	where: '"mandateReference" IS NOT NULL'
})
@ColumnIndex('IDX_payment_account_holder_open', ['status', 'updatedAt'], {
	where: '"status" IN (\'PENDING\', \'RESTRICTED\')'
})
// `UQ_payment_account_holder_active` is a uniqueness rule guarded by a **status value**, so MySQL has
// no generated-column form for it and the dialect gets no index at all. The rule is enforced by
// `PaymentAccountHolderService` inside the writing transaction and re-reported nightly by the schema
// audit, which is exactly what the schema chapter prescribes; the entity still declares the index,
// because Postgres and SQLite both support it and it is those two the generated DDL serves.
@MultiORMEntity('payment_account_holder', { mikroOrmRepository: () => MikroOrmPaymentAccountHolderRepository })
export class PaymentAccountHolder extends TenantOrganizationBaseEntity implements IPaymentAccountHolder {
	/**
	 * The party the account belongs to: a person, a company account or a seller's contact.
	 *
	 * Null only for a tenant-level account that belongs to the organization itself. The reference
	 * releases rather than cascades when a contact is soft-deleted, because the money records that point
	 * at this holder have to survive it.
	 */
	@ApiPropertyOptional({ type: () => OrganizationContact })
	@IsOptional()
	@MultiORMManyToOne(() => OrganizationContact, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	contact?: IOrganizationContact;

	/**
	 * Id of the party. The second column of the one-live-account-per-party rule.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PaymentAccountHolder) => it.contact)
	@MultiORMColumn({ nullable: true, relationId: true })
	contactId?: ID;

	/**
	 * The provider registration this account belongs to.
	 *
	 * **A plain identifier, and deliberately not a relation object.** The provider registry is a table
	 * the payment capability owns, and a kernel entity cannot import a package's entity class — doing so
	 * would make the kernel unbuildable until that package exists. The column is declared here, the
	 * kernel migration creates it **without** its foreign key, and the constraint is added by the
	 * capability's own `AddPaymentDomainForeignKeys` migration, which is this platform's rule that a
	 * constraint is added where its target is created. `providerKey` is what keeps a row addressable in
	 * the meantime.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	paymentProviderId?: ID;

	/**
	 * The provider's stable key, in the same vocabulary as the provider registry's own code.
	 *
	 * Retained when `paymentProviderId` is null, so a holder stays addressable after a registration is
	 * removed — and it is the leading column of both uniqueness rules, which is why it is not a copy of
	 * something the provider row could change.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64 })
	providerKey: string;

	/**
	 * The account's identifier **at the provider** — the provider's own customer, account or
	 * connected-account reference.
	 *
	 * Never a bank account number, an IBAN, a routing number or a card number: the provider holds the
	 * account and the platform holds its identifier. Null while the holder is `PENDING`, because the
	 * account does not exist at the provider until onboarding completes, and non-null for every holder
	 * that may be charged or paid out. The invariant is enforced by the service on every write, because
	 * it is a statement about a value and a status at once and no portable check expresses it.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	externalAccountId?: string;

	/**
	 * What kind of party the account belongs to. It decides the payout guard and scopes the default rule
	 * of the instruments beneath it, so it is fixed at creation and never edited.
	 */
	@ApiProperty({ type: () => String, enum: PaymentAccountHolderType, default: PaymentAccountHolderType.CUSTOMER })
	@IsEnum(PaymentAccountHolderType)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PaymentAccountHolderType,
		default: PaymentAccountHolderType.CUSTOMER
	})
	type: PaymentAccountHolderType;

	/**
	 * Where the relationship with the provider stands. The transition graph lives in the service; only
	 * `ACTIVE` may be charged or paid out, and `REJECTED` and `DISABLED` are terminal.
	 */
	@ApiProperty({ type: () => String, enum: PaymentAccountHolderStatus, default: PaymentAccountHolderStatus.PENDING })
	@IsEnum(PaymentAccountHolderStatus)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PaymentAccountHolderStatus,
		default: PaymentAccountHolderStatus.PENDING
	})
	status: PaymentAccountHolderStatus;

	/**
	 * The outcome of whatever identity or account verification the provider or an operator performed.
	 *
	 * Deliberately separate from the status: a provider can verify an account whose status is
	 * `RESTRICTED`, and an unverified account can still be `ACTIVE` on a provider that does not require
	 * verification for the flow in use.
	 */
	@ApiProperty({
		type: () => String,
		enum: PaymentAccountVerificationStatus,
		default: PaymentAccountVerificationStatus.UNVERIFIED
	})
	@IsEnum(PaymentAccountVerificationStatus)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PaymentAccountVerificationStatus,
		default: PaymentAccountVerificationStatus.UNVERIFIED
	})
	verificationStatus: PaymentAccountVerificationStatus;

	/**
	 * ISO 3166-1 alpha-2 country of establishment. It decides which provider capabilities, settlement
	 * currencies and mandate rules apply, and it is what a payout report is grouped by.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 2 })
	@IsOptional()
	@IsString()
	@Length(2, 2)
	@MultiORMColumn({ type: 'varchar', length: 2, nullable: true })
	country?: string;

	/**
	 * The currency this account settles in. Null means "resolve per charge from the collection".
	 *
	 * A payout is paid in this currency when it is set, which is why it is a column and not a key of
	 * `metadata`: a value a guard branches on cannot live in a document nothing filters.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	defaultCurrency?: CurrencyCode;

	/**
	 * The provider-issued mandate reference for a recurring debit against this account.
	 *
	 * It is the provider's identifier for the mandate — never the mandate text and never an account
	 * number. It is required, together with its acceptance instant, before a recurring-debit instrument
	 * of this holder may be charged with nobody present.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	mandateReference?: string;

	/**
	 * When the mandate was accepted by the party. Non-null exactly when `mandateReference` is non-null.
	 *
	 * Recorded because a debit without a dated mandate is a debit a dispute can unwind, and because the
	 * provider's own evidence is a timestamp. The two are written together or not at all: a write that
	 * sets one without the other is refused by the service.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	mandateAcceptedAt?: Date;

	/**
	 * The provider's onboarding fragment — capability flags, payout schedule, requested capabilities —
	 * plus tenant extras. Read whole; nothing here is filtered on.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * The saved instruments belonging to this account.
	 *
	 * The relationship cascades from the account, so an account that is removed takes its instruments
	 * with it — an instrument that names no account can never be charged, and leaving it behind would be
	 * a token nothing is responsible for. Disabling an account is the softer path, and it revokes every
	 * instrument beneath it in the same transaction rather than deleting them, because a charge history
	 * that points at a missing instrument is unauditable.
	 */
	@ApiPropertyOptional({ type: () => PaymentMethodToken, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMOneToMany(() => PaymentMethodToken, (it) => it.accountHolder, { cascade: true })
	methodTokens?: IPaymentMethodToken[];
}
