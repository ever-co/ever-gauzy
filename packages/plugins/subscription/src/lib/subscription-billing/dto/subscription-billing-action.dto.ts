import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Recording that a cycle's money arrived.
 *
 * The instant is a parameter rather than "now" because a payment is often recorded after it settled:
 * a bank transfer that cleared yesterday is booked yesterday, not when an operator typed it in.
 */
export class PaySubscriptionBillingDTO {
	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	readonly paidAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/**
 * Deliberately not charging a cycle.
 *
 * A waiver is a decision with a reason attached, so the reason is required: a waived period that
 * nobody can explain is indistinguishable from a period somebody forgot to bill.
 */
export class WaiveSubscriptionBillingDTO {
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	readonly reason: string;
}
