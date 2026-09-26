import { ID } from './base-entity.model';
import { CurrencyCode } from './money.model';
import { PaymentMethodTokenType } from './payment-method-token.model';

/**
 * What a caller asks when it wants to know whether a remembered payer may be charged.
 *
 * The shape is stated here, in the contracts package, rather than in the package that asks the
 * question: the party that remembers a payer — a subscription renewal, a repeat purchase, an
 * off-session authorisation — must be able to ask without depending on the kernel, and the kernel must
 * be able to answer without depending on the asker. The two sides are bound together at installation,
 * where one object satisfying both shapes is provided. Nothing here is a credential: a token value is
 * not part of this contract and never crosses it.
 */
export interface IPaymentInstrumentEligibilityRequest {
	/** The account at the provider the caller remembered, when it remembered one. */
	readonly accountHolderId?: ID;
	/** The instrument the caller remembered, when it remembered one. */
	readonly paymentMethodTokenId?: ID;
	/** The currency the charge is in. */
	readonly currency: CurrencyCode;
	/**
	 * The kind of instrument the charge wants, when it wants a particular kind.
	 *
	 * Optional, and absent means "whichever default the account holds". A holder legitimately holds one
	 * default card beside one default bank account, so a caller that cares which is charged states it.
	 */
	readonly type?: PaymentMethodTokenType;
}

/**
 * What the answer is: identifiers and a verdict, never a credential.
 *
 * A refusal is a normal answer and not an exception. The party asking is routinely a background
 * renewal with nobody present, and "this payer may not be charged, because its account is restricted"
 * is a fact it must record against the attempt and act on — dunning, a notification, a fall back to
 * another instrument — rather than an error it has to catch to stay alive. `chargeable: false` with a
 * `reasonCode` is therefore the shape of every refusal.
 */
export interface IPaymentInstrumentEligibilityResult {
	/** The account the charge would be made against, when one is known. */
	readonly accountHolderId?: ID;
	/** The instrument the charge would be made against, when one is known. */
	readonly paymentMethodTokenId?: ID;
	/** Whether the instrument may be charged, and if not, the platform code that says why. */
	readonly chargeable: boolean;
	/**
	 * The platform code explaining a refusal.
	 *
	 * Every value is a member of the platform's error-code catalogue, so the code a refusal carries is
	 * the same token a client branches on and a log line is greppable by. It is a `string` rather than
	 * the catalogue's own union because this contract is what a separately installed package reads, and
	 * a union would tie that package's build to the catalogue's every addition.
	 */
	readonly reasonCode?: string;
	/** Free-text explanation kept beside the refusal, for a human reading the attempt. */
	readonly reason?: string;
}

/**
 * The qualifiers a refusal's human-readable reason may carry, so a surface can branch on the cause
 * without parsing prose.
 *
 * They qualify a `reasonCode` and never replace one: the code says which guard refused, and the
 * qualifier says which of that guard's conditions did.
 */
export const PaymentInstrumentRefusalReason = {
	/** The instrument is a recurring debit and its account carries no mandate. */
	MANDATE_MISSING: 'MANDATE_MISSING',
	/** The account's settlement currency contradicts the currency of the charge. */
	CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
	/** The account holds no default instrument of the kind the charge is for. */
	NO_DEFAULT_INSTRUMENT: 'NO_DEFAULT_INSTRUMENT',
	/** The account holds more than one default of the kind asked for, so the caller has to name one. */
	AMBIGUOUS_DEFAULT_INSTRUMENT: 'AMBIGUOUS_DEFAULT_INSTRUMENT',
	/** The instrument does not belong to the account the caller named. */
	INSTRUMENT_NOT_OF_HOLDER: 'INSTRUMENT_NOT_OF_HOLDER'
} as const;

/** The union of the qualifiers above, so a consumer can exhaustively switch on it. */
export type PaymentInstrumentRefusalReason =
	(typeof PaymentInstrumentRefusalReason)[keyof typeof PaymentInstrumentRefusalReason];
