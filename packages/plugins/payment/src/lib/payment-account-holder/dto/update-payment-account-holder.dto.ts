import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentAccountVerificationStatus } from '@gauzy/contracts';
import { PaymentAccountHolderDTO } from './payment-account-holder.dto';

/**
 * Update PaymentAccountHolder request: every descriptive field of the create shape, all optional,
 * plus the two facts a descriptive update owns that a creation does not.
 *
 * **The verification outcome** belongs to this update because it is an observation rather than a
 * state: a provider can verify an account whose status is `RESTRICTED`, and an unverified account can
 * be `ACTIVE` on a provider that does not require verification, so the two are separate columns and
 * the verdict has a write of its own. Moving the status is the verify route's job, not this one.
 *
 * **The mandate is two halves and both are required together.** `mandateReference` and
 * `mandateAcceptedAt` are routed to the mandate operation rather than to the descriptive update,
 * because a debit without a dated mandate is a debit a dispute can unwind; a body that carries one
 * half is refused with `PAYMENT_ACCOUNT_HOLDER_MANDATE_INVALID`, and both stated as `null` clears the
 * mandate. Either half arriving on its own is never completed with a guess.
 *
 * The dates are ISO-8601 strings rather than `Date` instances: a request body is JSON, so a date
 * arrives as text and a `@IsDate()` member would refuse every request a client could actually send.
 */
export class UpdatePaymentAccountHolderDTO extends PartialType(PaymentAccountHolderDTO) {
	/**
	 * The outcome of the provider's or an operator's verification.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PaymentAccountVerificationStatus })
	@IsOptional()
	@IsEnum(PaymentAccountVerificationStatus)
	readonly verificationStatus?: PaymentAccountVerificationStatus;

	/**
	 * The provider's reference for the mandate, or `null` to clear both halves.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly mandateReference?: string | null;

	/**
	 * When the party accepted the mandate, or `null` to clear both halves.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsDateString()
	readonly mandateAcceptedAt?: string | null;
}
