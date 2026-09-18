import { Injectable } from '@nestjs/common';
import {
	ID,
	IPaymentAccountHolder,
	IPaymentAccountHolderUpdateInput,
	PaymentAccountHolderStatus,
	PaymentAccountVerificationStatus
} from '@gauzy/contracts';
import { PaymentAccountHolderService } from '@gauzy/core';
import { PaymentMethodTokenLifecycleService } from '../payment-method-token/payment-method-token-lifecycle.service';

/**
 * What a descriptive update of an account may state, plus the mandate the route carries.
 *
 * The mandate is two members of one fact, and the service that owns the account refuses both on a
 * descriptive update by design — it is written by the operation that observed the party accepting it.
 * The route therefore states them and this service routes them, rather than the transport layer
 * deciding which kernel method a member belongs to.
 */
export interface IUpdatePaymentAccountHolderRequest extends IPaymentAccountHolderUpdateInput {
	/** The provider-issued mandate reference, or `null` to clear both halves. */
	readonly mandateReference?: string | null;
	/** When the party accepted the mandate, or `null` to clear both halves. */
	readonly mandateAcceptedAt?: Date | string | null;
}

/**
 * What the verification route states.
 */
export interface IVerifyPaymentAccountHolderRequest {
	/** The outcome of whatever verification was performed. */
	readonly verificationStatus: PaymentAccountVerificationStatus;
	/** The status to move to; absent means the verdict decides. */
	readonly status?: PaymentAccountHolderStatus;
	/** The provider's own reference for the account, when onboarding completed with this verdict. */
	readonly reference?: string;
	/** When the verification lapses, when the provider states one. */
	readonly expiresAt?: Date | string;
	/** The reviewer's remark. */
	readonly note?: string;
}

/**
 * What disabling an account answers with: the account as stored, with the number of instruments the
 * close revoked beside it.
 *
 * The count travels on the row rather than inside an envelope, because that is the shape the endpoint
 * catalogue states for the route ("account (`status = DISABLED`), `revokedTokenCount`") and because a
 * GraphQL payload can take the row and the count from the same object without a second mapping.
 */
export interface IPaymentAccountHolderDisableResult extends IPaymentAccountHolder {
	/** How many of its instruments the disabling revoked in the same transaction. */
	readonly revokedTokenCount: number;
}

/**
 * The remembered payer as this API exposes it.
 *
 * The kernel owns every rule of the account — the status machine, the provider reference that is
 * written once, the mandate that is one fact in two halves, the one-live-account-per-party rule, and
 * the rule that closing an account revokes its instruments in the same transaction — and this service
 * owns none of them. It owns the **sequence**, which is the one thing a transport handler must not
 * invent twice:
 *
 * - **the detail**, which is the account plus the instruments beneath it, and the instruments are the
 *   *masked* summary because no expanded list carries a stored reference;
 * - **the descriptive update**, whose mandate members are routed to the mandate operation rather than
 *   handed to a descriptive write that refuses them;
 * - **the verification**, which records a verdict, records the provider's reference when onboarding
 *   completed with it, and then moves the status — in that order, because a move to `ACTIVE` requires
 *   the reference to have been recorded first and the kernel refuses it otherwise rather than
 *   guessing;
 * - **the disabling**, which reports how many instruments the close revoked.
 *
 * Both surfaces call these methods, so a REST caller and a GraphQL caller cannot reach different
 * behaviour for the same act.
 */
@Injectable()
export class PaymentAccountHolderLifecycleService {
	/**
	 * The metadata key the verification evidence is recorded under.
	 *
	 * `expiresAt` and `note` are the validity window and the reviewer's remark. Neither has a column in
	 * the account table and the kernel's update signature may not be changed, so both are recorded in
	 * the account's metadata fragment — the column the domain already keeps provider and tenant extras
	 * in — rather than accepted and dropped. The fragment is merged rather than replaced, so a provider
	 * fragment written by an earlier operation survives the verdict.
	 */
	private static readonly VERIFICATION_EVIDENCE = 'verification';

	constructor(
		private readonly paymentAccountHolderService: PaymentAccountHolderService,
		private readonly paymentMethodTokens: PaymentMethodTokenLifecycleService
	) {}

	/**
	 * Reads one account together with the instruments saved under it.
	 *
	 * @param id The account to read.
	 * @returns The account, with its instruments as the masked summary.
	 * @throws NotFoundException `PAYMENT_ACCOUNT_HOLDER_NOT_FOUND` when it is not in the caller's scope.
	 */
	async read(id: ID): Promise<IPaymentAccountHolder> {
		const holder = await this.paymentAccountHolderService.findHolderOrFail(id);
		const instruments = await this.paymentMethodTokens.list({ accountHolderId: id });

		return { ...holder, methodTokens: instruments.items };
	}

	/**
	 * Changes the descriptive facts of an account, and the mandate with them.
	 *
	 * The mandate runs first because it is the more constrained write: it is refused for a closed
	 * account and refused when only one of its halves is stated, and running it before the descriptive
	 * write means a mandate the platform cannot record leaves the account exactly as it was.
	 *
	 * @param id The account to change.
	 * @param input The facts to change.
	 * @returns The stored account, with its instruments.
	 * @throws BadRequestException `PAYMENT_ACCOUNT_HOLDER_MANDATE_INVALID` for half a mandate, and
	 * `PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID` for a lifecycle member or a closed account.
	 * @throws NotFoundException when the account is not in the caller's scope.
	 */
	async update(id: ID, input: IUpdatePaymentAccountHolderRequest): Promise<IPaymentAccountHolder> {
		const { mandateReference, mandateAcceptedAt, ...descriptive } = input ?? {};

		if (mandateReference !== undefined || mandateAcceptedAt !== undefined) {
			await this.recordMandate(id, mandateReference, mandateAcceptedAt);
		}

		const changes = this.descriptiveChanges(descriptive);

		if (Object.keys(changes).length) {
			await this.paymentAccountHolderService.updateHolder(id, changes as IPaymentAccountHolderUpdateInput);
		}

		return this.read(id);
	}

	/**
	 * Records a verification verdict and moves the account where the verdict says it belongs.
	 *
	 * The verdict and the state are different facts, which is why the verdict does not always move
	 * anything: a `VERIFIED` verdict takes a `PENDING` account to `ACTIVE` and a `REJECTED` one takes
	 * it to `REJECTED`, while a verdict of `PENDING`, `UNVERIFIED` or `EXPIRED` records the outcome and
	 * leaves the lifecycle alone. A caller that states the status itself is taken at its word and the
	 * status machine decides whether that move exists.
	 *
	 * A move is only attempted when the account is not already in the target status, because the
	 * machine has no self-transition: re-verifying an active account is an ordinary act and must not be
	 * refused for saying so.
	 *
	 * @param id The account being verified.
	 * @param input The verdict and the evidence around it.
	 * @returns The stored account, with its instruments.
	 * @throws BadRequestException `PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID` for a move the machine does
	 * not contain or an `ACTIVE` move without the provider's reference.
	 * @throws NotFoundException when the account is not in the caller's scope.
	 */
	async verify(id: ID, input: IVerifyPaymentAccountHolderRequest): Promise<IPaymentAccountHolder> {
		const holder = await this.paymentAccountHolderService.findHolderOrFail(id);

		await this.paymentAccountHolderService.updateHolder(id, {
			verificationStatus: input.verificationStatus,
			...this.evidenceChanges(holder, input)
		} as IPaymentAccountHolderUpdateInput);

		if (input.reference) {
			await this.paymentAccountHolderService.recordProviderAccount(id, input.reference);
		}

		const next = input.status ?? this.statusOfVerdict(input.verificationStatus);

		if (next && next !== holder.status) {
			await this.paymentAccountHolderService.transitionStatus(id, next);
		}

		return this.read(id);
	}

	/**
	 * Closes an account and revokes every instrument under it, in one transaction.
	 *
	 * The count is read before the close and the close performs the revocation itself, inside its own
	 * transaction and under a row lock on the account, so a caller is told what was revoked without
	 * this service opening a second unit of work — which is exactly the defect the kernel's rule
	 * exists to prevent.
	 *
	 * @param id The account to close.
	 * @returns The stored account, with how many instruments were revoked with it.
	 * @throws NotFoundException when the account is not in the caller's scope.
	 */
	async disable(id: ID): Promise<IPaymentAccountHolderDisableResult> {
		const revokedTokenCount = await this.paymentMethodTokens.countLive(id);
		const account = await this.paymentAccountHolderService.disableHolder(id);

		return { ...account, revokedTokenCount };
	}

	/**
	 * The status a verdict belongs to, when it belongs to one.
	 *
	 * @param verdict The recorded outcome.
	 * @returns The status the verdict moves a `PENDING` account to, or undefined when it moves nothing.
	 */
	private statusOfVerdict(verdict: PaymentAccountVerificationStatus): PaymentAccountHolderStatus | undefined {
		if (verdict === PaymentAccountVerificationStatus.VERIFIED) {
			return PaymentAccountHolderStatus.ACTIVE;
		}

		if (verdict === PaymentAccountVerificationStatus.REJECTED) {
			return PaymentAccountHolderStatus.REJECTED;
		}

		// `UNVERIFIED`, `PENDING` and `EXPIRED` are outcomes, not states of the relationship: an
		// account whose verification lapsed is still an account the provider may honour a mandate on.
		return undefined;
	}

	/**
	 * Writes the mandate, or clears both of its halves.
	 *
	 * @param id The account the mandate is against.
	 * @param reference The provider's reference, or null.
	 * @param acceptedAt When the party accepted it, or null.
	 * @throws BadRequestException `PAYMENT_ACCOUNT_HOLDER_MANDATE_INVALID` when only one half is stated.
	 */
	private async recordMandate(id: ID, reference?: string | null, acceptedAt?: Date | string | null): Promise<void> {
		if (reference === null && acceptedAt === null) {
			// Both halves go together, for the same reason they arrive together.
			await this.paymentAccountHolderService.clearMandate(id);
			return;
		}

		await this.paymentAccountHolderService.setMandate(id, {
			mandateReference: reference,
			mandateAcceptedAt: acceptedAt ? new Date(acceptedAt) : undefined
		} as never);
	}

	/**
	 * The descriptive members of a request, and nothing else.
	 *
	 * Built member by member rather than spread, so a member the contract does not carry cannot reach
	 * the write even if one is added to the transport shape later. The lifecycle members the kernel
	 * owns — the status, the provider's reference and the mandate — are not among them, and a body that
	 * states one is refused by the kernel's own guard rather than reaching it from here.
	 *
	 * @param input The request as stated.
	 * @returns The columns a descriptive update may write.
	 */
	private descriptiveChanges(input: IPaymentAccountHolderUpdateInput): Record<string, unknown> {
		const changes: Record<string, unknown> = {};
		const stated = (input ?? {}) as IPaymentAccountHolderUpdateInput;

		if (stated.contactId !== undefined) {
			changes.contactId = stated.contactId;
		}
		if (stated.paymentProviderId !== undefined) {
			changes.paymentProviderId = stated.paymentProviderId;
		}
		if (stated.providerKey !== undefined) {
			changes.providerKey = stated.providerKey;
		}
		if (stated.country !== undefined) {
			changes.country = stated.country;
		}
		if (stated.defaultCurrency !== undefined) {
			changes.defaultCurrency = stated.defaultCurrency;
		}
		if (stated.metadata !== undefined) {
			changes.metadata = stated.metadata;
		}

		return changes;
	}

	/**
	 * The metadata change the verification evidence needs, when the caller stated any.
	 *
	 * @param holder The account as stored, whose fragment is merged rather than replaced.
	 * @param input The request as stated.
	 * @returns The metadata column to write, or an empty object when there is no evidence to record.
	 */
	private evidenceChanges(
		holder: IPaymentAccountHolder,
		input: IVerifyPaymentAccountHolderRequest
	): Record<string, unknown> {
		if (input.expiresAt === undefined && input.note === undefined) {
			return {};
		}

		const current = holder.metadata;
		const base: Record<string, unknown> =
			current && typeof current === 'object' ? { ...(current as Record<string, unknown>) } : {};
		const previous =
			base[PaymentAccountHolderLifecycleService.VERIFICATION_EVIDENCE] &&
			typeof base[PaymentAccountHolderLifecycleService.VERIFICATION_EVIDENCE] === 'object'
				? { ...(base[PaymentAccountHolderLifecycleService.VERIFICATION_EVIDENCE] as Record<string, unknown>) }
				: {};

		return {
			metadata: {
				...base,
				[PaymentAccountHolderLifecycleService.VERIFICATION_EVIDENCE]: {
					...previous,
					...(input.expiresAt !== undefined ? { expiresAt: new Date(input.expiresAt) } : {}),
					...(input.note !== undefined ? { note: input.note } : {})
				}
			}
		};
	}
}
