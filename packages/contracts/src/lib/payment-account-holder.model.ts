import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { CurrencyCode } from './money.model';
import { IOrganizationContact } from './organization-contact.model';
import { IPaymentMethodToken } from './payment-method-token.model';

/**
 * What kind of party the account at the provider belongs to.
 *
 * The value decides behaviour and not merely a label: the payout path refuses anything but `SELLER`,
 * the default-instrument rule of a saved instrument is scoped by `(holder, instrument type)`, and the
 * marketplace reports this holder's verification as the seller's payout-account status. A free-text
 * kind would let one fact be spelled three ways and would put the payout guard at the mercy of a
 * spelling, which is why it is an enumeration and its value set is fixed.
 */
export enum PaymentAccountHolderType {
	/** A buyer's account: the payer a saved instrument belongs to. */
	CUSTOMER = 'CUSTOMER',
	/** A marketplace seller's payout account — the account a settlement is paid out to. */
	SELLER = 'SELLER',
	/** The organization's own account, used for charges it makes on its own behalf and payouts it receives as a party. */
	ORGANIZATION = 'ORGANIZATION'
}

/**
 * Where the standing relationship with the provider stands.
 *
 * It is an enumeration because the charge guard, the payout guard and the dunning path each branch on
 * it, and because `RESTRICTED` exists precisely so that "the provider accepts no new charge while an
 * existing mandate is still honoured" has one spelling rather than being modelled as a boolean pair.
 * The transition graph is `PENDING → ACTIVE | REJECTED | DISABLED`, `ACTIVE → RESTRICTED | DISABLED`
 * and `RESTRICTED → ACTIVE | DISABLED`, and no other move: `REJECTED` and `DISABLED` are terminal, so
 * an account a provider refused is never silently reused.
 */
export enum PaymentAccountHolderStatus {
	/** Being created or verified at the provider. The external account id is null and nothing may be charged. */
	PENDING = 'PENDING',
	/** The provider accepts charges and payouts against this account. The only chargeable and payable status. */
	ACTIVE = 'ACTIVE',
	/** No **new** charge is accepted, while existing mandates are still honoured (a dispute review, a lapsed verification). */
	RESTRICTED = 'RESTRICTED',
	/** The provider or the platform's verification refused the account. Terminal; a new application is a new row. */
	REJECTED = 'REJECTED',
	/** Closed by the platform or by the party. Terminal, and its instruments are revoked in the same transaction. */
	DISABLED = 'DISABLED'
}

/**
 * The outcome of whatever identity or account verification was performed.
 *
 * Kept separate from {@link PaymentAccountHolderStatus} on purpose: a provider can verify an account
 * whose status is `RESTRICTED`, and an unverified account can still be `ACTIVE` on a provider that
 * does not require verification for the flow in use. Collapsing the two would make "verified but
 * restricted" and "active but unverified" unrepresentable, and both are real states that change what
 * may be charged.
 */
export enum PaymentAccountVerificationStatus {
	/** No verification has been attempted. */
	UNVERIFIED = 'UNVERIFIED',
	/** Submitted and awaiting the provider's or a reviewer's verdict. */
	PENDING = 'PENDING',
	/** The provider or an operator confirmed the account. */
	VERIFIED = 'VERIFIED',
	/** The verdict was negative, so the account may not be charged or paid out until it is re-verified. */
	REJECTED = 'REJECTED',
	/** A verification that was valid has lapsed past its validity window. */
	EXPIRED = 'EXPIRED'
}

/**
 * The columns of one party's account at one provider, plus the relations the kernel reads.
 *
 * The row is the standing relationship itself — the thing a saved instrument, a mandate and an
 * off-session charge all hang off — and never a movement of money. `providerKey` is retained beside
 * `paymentProviderId` so that a row stays addressable after a provider registration is removed, and it
 * is the leading column of the uniqueness rule that makes one account one row.
 */
export interface IPaymentAccountHolder extends IBasePerTenantAndOrganizationEntityModel {
	/** The party the account belongs to. Null only for a tenant-level account owned by the organization itself. */
	contactId?: ID;
	/** The party row `contactId` names. */
	contact?: IOrganizationContact;
	/**
	 * The provider registration the account belongs to.
	 *
	 * A plain identifier rather than a relation object: the provider registry is a table the payment
	 * capability owns and the kernel cannot import its entity. The column is usable whether or not that
	 * capability is installed, and the constraint is added by the set that creates the target.
	 */
	paymentProviderId?: ID;
	/** The provider's stable key. The same vocabulary as the provider registry's own code, and retained when `paymentProviderId` is null. */
	providerKey: string;
	/**
	 * The account's identifier **at the provider** — its own customer, account or connected-account
	 * reference. Never a bank account number, an IBAN, a routing number or a card number: the provider
	 * holds the account and the platform holds its identifier. Null while the holder is `PENDING`.
	 */
	externalAccountId?: string;
	/** What kind of party the account belongs to. */
	type: PaymentAccountHolderType;
	/** Where the relationship with the provider stands. Only `ACTIVE` may be charged or paid out. */
	status: PaymentAccountHolderStatus;
	/** The outcome of the provider's or an operator's account verification. */
	verificationStatus: PaymentAccountVerificationStatus;
	/** ISO 3166-1 alpha-2 country of establishment, which decides capabilities, settlement currencies and mandate rules. */
	country?: string;
	/** The currency this account settles in. Null means "resolve per charge from the collection". */
	defaultCurrency?: CurrencyCode;
	/** The provider-issued mandate reference for a recurring debit against this account; never the mandate text and never an account number. */
	mandateReference?: string;
	/** When the mandate was accepted by the party. Non-null exactly when `mandateReference` is non-null. */
	mandateAcceptedAt?: Date;
	/** The provider's onboarding fragment (capability flags, payout schedule) plus tenant extras. */
	metadata?: JsonData;
	/** The saved instruments belonging to this account. */
	methodTokens?: IPaymentMethodToken[];
}

/**
 * What a caller may state when an account at a provider is recorded.
 *
 * The lifecycle fields are deliberately absent: the status starts at `PENDING` and moves only through
 * the status machine, the external account id is recorded from the provider's own answer, and the
 * mandate is recorded by the mandate write. None of them is something a create body states.
 */
export interface IPaymentAccountHolderCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	/** The party the account belongs to, when it belongs to one. */
	contactId?: ID;
	/** The provider registration, when the caller knows it. */
	paymentProviderId?: ID;
	/** The provider's stable key. Required: without it a row cannot be addressed after the registration is removed. */
	providerKey: string;
	/** What kind of party the account belongs to. Defaults to `CUSTOMER`. */
	type?: PaymentAccountHolderType;
	/** ISO 3166-1 alpha-2 country of establishment. */
	country?: string;
	/** The currency this account settles in. */
	defaultCurrency?: CurrencyCode;
	/** The provider's onboarding fragment plus tenant extras. */
	metadata?: JsonData;
}

/**
 * What a caller may change on an existing account.
 *
 * A type is what the account *is* and the status moves through the machine, so neither is here: a body
 * that changes one is refused rather than silently ignored.
 */
export interface IPaymentAccountHolderUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	/** The party the account belongs to. */
	contactId?: ID;
	/** The provider registration. */
	paymentProviderId?: ID;
	/** The provider's stable key, when the caller is correcting it. */
	providerKey?: string;
	/** The outcome of a verification. */
	verificationStatus?: PaymentAccountVerificationStatus;
	/** ISO 3166-1 alpha-2 country of establishment. */
	country?: string;
	/** The currency this account settles in. */
	defaultCurrency?: CurrencyCode;
	/** The provider's onboarding fragment plus tenant extras. */
	metadata?: JsonData;
}

/**
 * What a caller states when it records the mandate that backs a recurring debit.
 *
 * Both members are required together and neither has a default: a mandate reference without the
 * instant the party accepted it is a debit a dispute can unwind, and an acceptance without the
 * provider's reference names no mandate at all. A write that carries one and not the other is refused.
 */
export interface IPaymentAccountHolderMandateInput {
	/** The provider-issued mandate reference. */
	mandateReference: string;
	/** When the party accepted the mandate. */
	mandateAcceptedAt: Date;
}

/** The fields a caller may filter a list of accounts by. */
export interface IPaymentAccountHolderFindInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Restrict to the accounts of one party. */
	contactId?: ID;
	/** Restrict to the accounts of one provider key. */
	providerKey?: string;
	/** Restrict to one or more lifecycle statuses. */
	status?: PaymentAccountHolderStatus;
	/** Restrict to one or more account kinds. */
	type?: PaymentAccountHolderType;
}
