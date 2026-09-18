import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentAccountHolderStatus, PaymentAccountVerificationStatus } from '@gauzy/contracts';

/**
 * The body of `POST /payment-account-holders/:id/verify`.
 *
 * The verdict is required and the rest is the evidence around it. `status` is optional because the
 * verdict and the state are different facts: a `VERIFIED` verdict moves a `PENDING` account to
 * `ACTIVE` (once the provider's reference has been recorded) and a `REJECTED` one moves it to
 * `REJECTED`, while a verdict of `PENDING` or `EXPIRED` moves nothing. A caller that states the
 * status itself is taken at its word and the status machine decides whether the move exists.
 *
 * `reference` is the provider's own identifier for the account, recorded by the operation that
 * observed it — which is this one, on the answer that onboarding completed.
 *
 * `expiresAt` and `note` are the validity window and the reviewer's remark. Neither has a column of
 * its own in the account table, so both are recorded in the account's metadata fragment rather than
 * dropped: the platform's rule is that a member a route accepts is a member the platform keeps.
 * The dates are ISO-8601 strings, because a request body is JSON.
 */
export class VerifyPaymentAccountHolderDTO {
	/**
	 * The outcome of whatever identity or account verification was performed.
	 */
	@ApiProperty({ type: () => String, enum: PaymentAccountVerificationStatus })
	@IsEnum(PaymentAccountVerificationStatus)
	readonly verificationStatus: PaymentAccountVerificationStatus;

	/**
	 * The status to move the account to; absent means the verdict decides.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PaymentAccountHolderStatus })
	@IsOptional()
	@IsEnum(PaymentAccountHolderStatus)
	readonly status?: PaymentAccountHolderStatus;

	/**
	 * The provider's own reference for the account, when onboarding completed with this verdict.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly reference?: string;

	/**
	 * When the verification lapses, when the provider states one.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsDateString()
	readonly expiresAt?: string;

	/**
	 * The reviewer's remark.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 2000 })
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	readonly note?: string;
}
