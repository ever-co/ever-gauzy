import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { IPaymentAccountHolder } from './payment-account-holder.model';

/**
 * What kind of instrument a saved token is.
 *
 * It is a column and not a provider capability flag because the default rule is scoped by it — one
 * default card beside one default bank account is a legitimate configuration — and because a
 * `DIRECT_DEBIT` instrument carries the mandate requirement the other three do not. A free-text kind
 * would put that mandate guard at the mercy of a spelling.
 */
export enum PaymentMethodTokenType {
	/** A payment card, held in the provider's vault. It has a brand, a last-four and an expiry. */
	CARD = 'CARD',
	/** A bank account, held at the provider. It is a payout destination, and it does not expire. */
	BANK_ACCOUNT = 'BANK_ACCOUNT',
	/** A provider-side wallet or stored balance. It carries no expiry and usually no last-four. */
	WALLET = 'WALLET',
	/** A recurring debit against the payer's account, which requires a mandate on its holder before any off-session charge. */
	DIRECT_DEBIT = 'DIRECT_DEBIT'
}

/**
 * Whether a saved instrument may be charged.
 *
 * Three of the four values are terminal in different ways and the fourth decides eligibility: the
 * charge guard asks whether the status is `ACTIVE`, the default rule asks the same question, and the
 * notification path distinguishes "your card expired" from "your card was refused" from "you removed
 * it" — three different messages a single "inactive" would flatten.
 */
export enum PaymentMethodTokenStatus {
	/** Chargeable. The only status a charge may use and the only status a default instrument may hold. */
	ACTIVE = 'ACTIVE',
	/** The instrument's expiry has passed. Terminal; a charge is refused. */
	EXPIRED = 'EXPIRED',
	/** Removed by the party, by staff, or by disabling its account holder. Terminal, and the only removal path there is. */
	REVOKED = 'REVOKED',
	/** The provider refused it in a way no retry can change, or it crossed the decline threshold. Recoverable only by a successful charge. */
	FAILED = 'FAILED'
}

/**
 * What the provider itself answered when the platform confirmed an instrument with it.
 *
 * **This is the record that makes a token row a provider reference rather than a value a caller
 * composed.** The instrument is held in the provider's vault; the platform holds a token that is
 * meaningless outside a call to that provider with the tenant's own credentials, so the row may only
 * be written from a reference the provider issued and the platform then confirmed. The confirmation
 * carries the same reference back, and a creation whose token and confirmation disagree is refused.
 */
export interface IPaymentMethodTokenConfirmation {
	/** The reference the provider returned when the platform re-read the instrument at the provider. */
	token: string;
	/** When the provider confirmed it. */
	confirmedAt: Date;
}

/**
 * The columns of one saved instrument belonging to an account holder.
 *
 * **Hard rule: `token` is a provider-issued reference and never card data.** There is no member here —
 * and no column behind it — for a primary account number, a verification value, a full bank account
 * number or any track or chip data, and none may be added. The provider's hosted vault holds the
 * instrument; the platform holds a token that is meaningless outside a call to that provider.
 */
export interface IPaymentMethodToken extends IBasePerTenantAndOrganizationEntityModel {
	/** The account at the provider this instrument belongs to. An instrument has no meaning without its account. */
	accountHolderId: ID;
	/** The account row `accountHolderId` names. */
	accountHolder?: IPaymentAccountHolder;
	/**
	 * The provider registration, duplicated from the holder for the join.
	 *
	 * A plain identifier rather than a relation object: the provider registry is a table the payment
	 * capability owns, and the constraint is added by the set that creates the target. It is kept
	 * consistent with the holder's by the service, because a token can never be moved to another
	 * provider than its holder's.
	 */
	paymentProviderId?: ID;
	/** The provider's stable key. Must equal the holder's. */
	providerKey: string;
	/** The provider's tokenised reference. Never a primary account number, never a verification value, never a bank account number. */
	token: string;
	/** What kind of instrument this is. */
	type: PaymentMethodTokenType;
	/** The provider's brand label for the instrument, exactly as the provider reports it. Display only; never used to route a charge. */
	brand?: string;
	/** The last four digits the provider returns, for display only. Null for a wallet or a provider that returns none. */
	last4?: string;
	/** 1–12. Null when the instrument does not expire or the provider does not disclose it. */
	expiryMonth?: number;
	/** Four digits. Together with `expiryMonth` it feeds the expiry sweep and the expiry refusal. */
	expiryYear?: number;
	/** The name on the instrument as the provider reports it, for display on the party's own instrument list. */
	holderName?: string;
	/**
	 * The address the instrument bills to, from the address book.
	 *
	 * A plain identifier: the address book is a core table owned by the module that declares it, and
	 * the constraint is created by the migration where that table is present.
	 */
	billingAddressId?: ID;
	/** The instrument used when a caller names none, and the one a renewal charges. At most one per `(accountHolderId, type)`. */
	isDefault: boolean;
	/** Whether the instrument may be charged. */
	status: PaymentMethodTokenStatus;
	/** Stamped on every authorisation attempt that reached the provider, successful or not. */
	lastUsedAt?: Date;
	/** Non-null exactly when the status is `REVOKED`. The row is kept, because a charge history that points at a missing instrument is unauditable. */
	revokedAt?: Date;
	/** The provider fragment plus the decline bookkeeping, which is a cache and never a source of truth. */
	metadata?: JsonData;
}

/**
 * What a caller states when an instrument the provider issued is recorded.
 *
 * `providerConfirmation` is required and not optional: it is the fact that the reference came from the
 * provider rather than from the request body, and a creation without it is refused.
 */
export interface IPaymentMethodTokenCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	/** The account at the provider this instrument belongs to. */
	accountHolderId: ID;
	/** The provider's stable key. Must equal the holder's, and is checked rather than trusted. */
	providerKey: string;
	/** The provider's tokenised reference, as the provider issued it. */
	token: string;
	/** The provider's own answer confirming that reference. Required. */
	providerConfirmation: IPaymentMethodTokenConfirmation;
	/** What kind of instrument this is. Defaults to `CARD`. */
	type?: PaymentMethodTokenType;
	/** The provider's brand label. */
	brand?: string;
	/** The provider's display digits. */
	last4?: string;
	/** 1–12, and only for an instrument that expires. */
	expiryMonth?: number;
	/** Four digits, and only for an instrument that expires. */
	expiryYear?: number;
	/** The name on the instrument. */
	holderName?: string;
	/** The address the instrument bills to. */
	billingAddressId?: ID;
	/** Whether this becomes the holder's default for its type. Refused unless the instrument is `ACTIVE`. */
	isDefault?: boolean;
	/** The provider fragment plus tenant extras. */
	metadata?: JsonData;
}

/**
 * What a caller may change on a saved instrument.
 *
 * The token, the account holder, the provider key and the type are not among them: a token's reference
 * is what the provider issued, an instrument never moves between accounts, and the type decides the
 * default rule and the mandate requirement. The status moves through revocation, expiry and use.
 */
export interface IPaymentMethodTokenUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	/** The provider's brand label. */
	brand?: string;
	/** The provider's display digits. */
	last4?: string;
	/** 1–12, and only for an instrument that expires. */
	expiryMonth?: number;
	/** Four digits, and only for an instrument that expires. */
	expiryYear?: number;
	/** The name on the instrument. */
	holderName?: string;
	/** The address the instrument bills to. */
	billingAddressId?: ID;
	/** The provider fragment plus tenant extras. */
	metadata?: JsonData;
}

/** The fields a caller may filter a list of saved instruments by. */
export interface IPaymentMethodTokenFindInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Restrict to one account at the provider. */
	accountHolderId?: ID;
	/** Restrict to one provider key. */
	providerKey?: string;
	/** Restrict to one or more instrument types. */
	type?: PaymentMethodTokenType;
	/** Restrict to one or more lifecycle statuses. */
	status?: PaymentMethodTokenStatus;
}
