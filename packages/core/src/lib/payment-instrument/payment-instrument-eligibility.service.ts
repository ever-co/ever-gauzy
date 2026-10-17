import { Injectable } from '@nestjs/common';
import {
	CurrencyCode,
	ID,
	IPaymentAccountHolder,
	IPaymentInstrumentEligibilityRequest,
	IPaymentInstrumentEligibilityResult,
	IPaymentMethodToken,
	PaymentAccountHolderStatus,
	PaymentInstrumentRefusalReason,
	PaymentMethodTokenStatus,
	PaymentMethodTokenType
} from '@gauzy/contracts';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { PaymentAccountHolderService } from '../payment-account-holder/payment-account-holder.service';
import { PaymentMethodTokenService } from '../payment-method-token/payment-method-token.service';

/**
 * The one question a party that remembered a payer asks: **may this payer be charged, and with what?**
 *
 * **Why this is a service of its own rather than a method on either neighbour.** The answer needs both
 * tables — the account's status and mandate, and the instrument's status and default — and it needs
 * them in one decision. A caller that read them itself would be re-implementing the order the checks
 * have to run in, and the order is the substance: an account that is closed refuses before any
 * instrument is considered, a revoked instrument refuses before a mandate is looked for, and a mandate
 * is looked for only for the kind of instrument that needs one. Stating that once, here, is what makes
 * every consumer of a remembered payer agree.
 *
 * **A refusal is a normal answer, never an exception.** The caller is routinely a scheduled renewal
 * with nobody present, and "this payer may not be charged because its account is restricted" is a fact
 * it records against the attempt and acts on — dunning, a notification, a fall back to another
 * instrument — rather than an error it has to catch to stay alive. Every refusal therefore comes back as
 * `chargeable: false` with the platform code that names the guard and a human reason beside it. Nothing
 * this service returns carries an instrument reference: the token value is what the caller must never
 * hold, and the identifiers it does carry are ids.
 *
 * **It answers about a payer, not about a charge.** No amount is taken and nothing is written, so the
 * answer is a pre-flight verdict rather than a reservation: the provider may still refuse the charge
 * this method said was eligible, and the caller records that refusal against the instrument through
 * `PaymentMethodTokenService.recordProviderAttempt`.
 */
@Injectable()
export class PaymentInstrumentEligibilityService {
	constructor(
		private readonly paymentAccountHolderService: PaymentAccountHolderService,
		private readonly paymentMethodTokenService: PaymentMethodTokenService
	) {}

	/**
	 * Resolves the instrument a charge against a remembered payer may use.
	 *
	 * The named instrument wins when the caller named one, and otherwise the account's default for the
	 * kind the caller asked for is used — a caller that asks for no particular kind and whose account
	 * holds more than one default is refused rather than guessed at, because charging the wrong kind is
	 * not a recoverable mistake. The guards then run in the order the class note states.
	 *
	 * @param request Which payer, and in which currency.
	 * @returns Whether the payer may be charged, and which instrument resolves.
	 */
	async resolveChargeableInstrument(
		request: IPaymentInstrumentEligibilityRequest
	): Promise<IPaymentInstrumentEligibilityResult> {
		const currency = this.normaliseCurrency(request?.currency);

		if (!currency) {
			return this.refuse(
				ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED,
				'the charge states no currency, and an instrument cannot be judged eligible for an unstated one.'
			);
		}

		const named = await this.resolveNamedPayer(request);

		if (named.reasonCode) {
			return this.refuse(named.reasonCode, named.reason ?? 'the charge names a payer that cannot be resolved.', {
				accountHolderId: named.holder?.id,
				paymentMethodTokenId: named.token?.id ?? request?.paymentMethodTokenId
			});
		}

		if (!named.holder) {
			return this.refuse(
				ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_NOT_FOUND,
				'the charge names neither an account nor an instrument this organization has, so there is nothing to charge against.'
			);
		}

		const { holder } = named;

		if (holder.status !== PaymentAccountHolderStatus.ACTIVE) {
			return this.refuse(
				ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_RESTRICTED,
				`the account is ${holder.status}, and only an active account may be charged; a restricted account honours an existing mandate but accepts no new charge.`,
				{ accountHolderId: holder.id, paymentMethodTokenId: named.token?.id }
			);
		}

		const resolved: {
			instrument?: IPaymentMethodToken;
			reasonCode?: string;
			reason?: string;
			ambiguousId?: ID;
		} = named.token ? { instrument: named.token } : await this.resolveDefaultInstrument(holder, request?.type);

		if (!resolved.instrument) {
			return this.refuse(resolved.reasonCode, resolved.reason, {
				accountHolderId: holder.id,
				paymentMethodTokenId: resolved.ambiguousId
			});
		}

		const token = resolved.instrument;

		if (token.status === PaymentMethodTokenStatus.REVOKED) {
			return this.refuse(
				ApiErrorCode.PAYMENT_METHOD_TOKEN_REVOKED,
				'the instrument was removed and is never charged again; re-adding it writes a new instrument.',
				{ accountHolderId: holder.id, paymentMethodTokenId: token.id }
			);
		}

		if (token.status === PaymentMethodTokenStatus.EXPIRED) {
			return this.refuse(
				ApiErrorCode.PAYMENT_METHOD_TOKEN_EXPIRED,
				"the instrument's expiry has passed and it is never charged again; the party has to save a replacement.",
				{ accountHolderId: holder.id, paymentMethodTokenId: token.id }
			);
		}

		if (token.status !== PaymentMethodTokenStatus.ACTIVE) {
			return this.refuse(
				ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED,
				`the instrument is ${token.status}, which the provider refused in a way no retry can change; it is chargeable again only once it is saved again.`,
				{ accountHolderId: holder.id, paymentMethodTokenId: token.id }
			);
		}

		if (token.type === PaymentMethodTokenType.DIRECT_DEBIT && !this.paymentAccountHolderService.hasMandate(holder)) {
			return this.refuse(
				ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_RESTRICTED,
				`${PaymentInstrumentRefusalReason.MANDATE_MISSING}: a recurring debit is charged with nobody present only while its account carries both the provider's mandate reference and the instant the party accepted it.`,
				{ accountHolderId: holder.id, paymentMethodTokenId: token.id }
			);
		}

		if (holder.defaultCurrency && this.normaliseCurrency(holder.defaultCurrency) !== currency) {
			return this.refuse(
				ApiErrorCode.PAYMENT_CURRENCY_MISMATCH,
				`${PaymentInstrumentRefusalReason.CURRENCY_MISMATCH}: the account settles in ${holder.defaultCurrency} and the charge is in ${currency}.`,
				{ accountHolderId: holder.id, paymentMethodTokenId: token.id }
			);
		}

		return {
			accountHolderId: holder.id,
			paymentMethodTokenId: token.id,
			chargeable: true
		};
	}

	/**
	 * Resolves the account and the instrument the request named, if it named any.
	 *
	 * A miss is an answer here rather than an exception, which is why the two reads are the services'
	 * answering form rather than their raising one: a scheduled renewal asking about a payer that was
	 * removed has to be told so, not thrown at.
	 *
	 * @param request The charge's request.
	 * @returns The account, the instrument, and — when the two disagree — the refusal that explains it.
	 */
	private async resolveNamedPayer(request: IPaymentInstrumentEligibilityRequest): Promise<{
		holder?: IPaymentAccountHolder;
		token?: IPaymentMethodToken;
		reasonCode?: string;
		reason?: string;
	}> {
		let holder: IPaymentAccountHolder | null = null;

		if (request?.accountHolderId) {
			holder = await this.paymentAccountHolderService.findHolder(request.accountHolderId);

			if (!holder) {
				return {
					reasonCode: ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_NOT_FOUND,
					reason: 'no account at the provider matches the one the charge named.'
				};
			}
		}

		if (!request?.paymentMethodTokenId) {
			return { holder: holder ?? undefined };
		}

		const token = await this.paymentMethodTokenService.findToken(request.paymentMethodTokenId);

		if (!token) {
			return {
				holder: holder ?? undefined,
				reasonCode: ApiErrorCode.PAYMENT_METHOD_TOKEN_NOT_FOUND,
				reason: 'no saved instrument matches the one the charge named.'
			};
		}

		if (holder && String(token.accountHolderId) !== String(holder.id)) {
			return {
				holder,
				reasonCode: ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED,
				reason: `${PaymentInstrumentRefusalReason.INSTRUMENT_NOT_OF_HOLDER}: the instrument does not belong to the account the charge named.`
			};
		}

		if (!holder) {
			holder = await this.paymentAccountHolderService.findHolder(token.accountHolderId);
		}

		return { holder: holder ?? undefined, token };
	}

	/**
	 * Resolves the account's default instrument for the kind asked for.
	 *
	 * @param holder The account at the provider.
	 * @param type The kind asked for; absent means any kind.
	 * @returns The default instrument, or the refusal that explains why there is none to use.
	 */
	private async resolveDefaultInstrument(
		holder: IPaymentAccountHolder,
		type?: PaymentMethodTokenType
	): Promise<{
		instrument?: IPaymentMethodToken;
		reasonCode?: string;
		reason?: string;
		ambiguousId?: ID;
	}> {
		const defaults = await this.paymentMethodTokenService.findDefaultTokens(holder.id, type);

		if (!defaults.length) {
			return {
				reasonCode: ApiErrorCode.PAYMENT_METHOD_TOKEN_NOT_FOUND,
				reason: `${PaymentInstrumentRefusalReason.NO_DEFAULT_INSTRUMENT}: the account holds no default instrument${type ? ` of kind ${type}` : ''}, so the charge has to name one.`
			};
		}

		if (defaults.length === 1) {
			return { instrument: defaults[0] };
		}

		// One default per account and kind is the stored rule, so more than one can only mean the caller
		// asked for no particular kind and the account holds several — one card beside one bank account.
		// Exactly one of them being chargeable is a fact rather than a choice, and anything else needs
		// the caller to say which it means.
		const chargeable = defaults.filter((row) => row.status === PaymentMethodTokenStatus.ACTIVE);

		if (chargeable.length === 1) {
			return { instrument: chargeable[0] };
		}

		return {
			reasonCode: ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED,
			reason: `${PaymentInstrumentRefusalReason.AMBIGUOUS_DEFAULT_INSTRUMENT}: the account holds ${defaults.length} default instruments and the charge names none of them, so it has to state which kind it wants.`,
			ambiguousId: defaults[0].id
		};
	}

	/**
	 * Normalises a currency for comparison.
	 *
	 * @param currency The currency as stated.
	 * @returns The upper-cased code, or undefined when none was stated.
	 */
	private normaliseCurrency(currency?: CurrencyCode | string): string | undefined {
		const stated = currency ? String(currency).trim().toUpperCase() : '';

		return stated.length ? stated : undefined;
	}

	/**
	 * Builds a refusal.
	 *
	 * Every refusal carries the code of the guard that refused and a human reason beside it, and no
	 * refusal carries a credential — the identifiers it may carry are ids, and the caller already
	 * holds them.
	 *
	 * @param reasonCode The platform code naming the guard.
	 * @param reason The human explanation.
	 * @param identifiers The ids the caller may record against the attempt.
	 * @returns The refusal.
	 */
	private refuse(
		reasonCode: string,
		reason: string,
		identifiers: { accountHolderId?: ID; paymentMethodTokenId?: ID } = {}
	): IPaymentInstrumentEligibilityResult {
		return {
			accountHolderId: identifiers.accountHolderId,
			paymentMethodTokenId: identifiers.paymentMethodTokenId,
			chargeable: false,
			reasonCode,
			reason
		};
	}
}
