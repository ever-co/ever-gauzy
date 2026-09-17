import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * A pause: for how long, and why.
 *
 * `until` may be omitted, which means the pause is indefinite and only a resume ends it. The billing
 * run skips a paused subscription either way, and the period is not consumed while it is paused.
 */
export class PauseSubscriptionDTO {
	@ApiPropertyOptional({ type: () => 'timestamptz', description: 'When the subscription resumes itself.' })
	@IsOptional()
	@IsDate()
	readonly until?: Date;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly reason?: string;
}

/**
 * A cancellation.
 *
 * `immediate` decides which of the two cancellations this is: the default ends the subscription with
 * the period the customer already paid for, and `true` stops it now.
 */
export class CancelSubscriptionDTO {
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly reason?: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	readonly immediate?: boolean;
}

/**
 * An expiry, which is what reaching the plan's cycle ceiling or an end date produces.
 */
export class ExpireSubscriptionDTO {
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly reason?: string;
}

/**
 * A move to another plan, and when it takes effect.
 *
 * `IMMEDIATE` settles the difference for the remainder of the current period; `NEXT_PERIOD` schedules
 * the change so the new price applies from the next cycle and no money moves now.
 */
export class ChangeSubscriptionPlanDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly planId: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "3.000000".' })
	@IsOptional()
	@IsString()
	readonly quantity?: string;

	@ApiPropertyOptional({ type: () => String, enum: ['IMMEDIATE', 'NEXT_PERIOD'], default: 'IMMEDIATE' })
	@IsOptional()
	@IsEnum(['IMMEDIATE', 'NEXT_PERIOD'])
	readonly effective?: 'IMMEDIATE' | 'NEXT_PERIOD';

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/**
 * A manual billing attempt on one subscription.
 */
export class BillSubscriptionDTO {
	@ApiPropertyOptional({ type: () => 'timestamptz', description: 'Instant to bill against; defaults to now.' })
	@IsOptional()
	@IsDate()
	readonly asOf?: Date;
}

/**
 * A billing run, narrowed to one subscription or run across every due one.
 */
export class RunSubscriptionBillingDTO {
	@ApiPropertyOptional({ type: () => String, description: 'Bill only this subscription.' })
	@IsOptional()
	@IsUUID()
	readonly subscriptionId?: ID;

	@ApiPropertyOptional({ type: () => Number, default: 200 })
	@IsOptional()
	readonly limit?: number;

	@ApiPropertyOptional({ type: () => 'timestamptz', description: 'Instant to treat as now.' })
	@IsOptional()
	@IsDate()
	readonly asOf?: Date;
}
