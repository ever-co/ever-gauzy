import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** The body of `POST /entitlements/:id/extend`. */
export class ExtendEntitlementDTO {
	@ApiProperty({ type: () => Date, description: 'The new end of the term; later than the current one.' })
	@IsNotEmpty()
	@IsDate()
	readonly endsAt: Date;

	@ApiPropertyOptional({ type: () => Number, minimum: 0, description: 'The quantity the renewal was billed for.' })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly quantity?: number;

	@ApiPropertyOptional({ type: () => String, description: 'The subscription billing cycle that extended it.' })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/** The body of `POST /entitlements/:id/revoke`. */
export class RevokeEntitlementDTO {
	@ApiProperty({
		type: () => String,
		maxLength: 255,
		description: '`REFUNDED`, `CHARGEBACK`, `RETURNED`, `DATA_ERASURE`, or an operator note.'
	})
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	readonly reason: string;
}

/** The body of `POST /entitlements/:id/suspend`. */
export class SuspendEntitlementDTO {
	@ApiPropertyOptional({
		type: () => String,
		maxLength: 255,
		description: '`PAYMENT_FAILED` when dunning suspended it, or an operator note.'
	})
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly reason?: string;
}

/** The body of `POST /entitlements/:id/reduce`, which is what a partial refund lowers the ceiling with. */
export class ReduceEntitlementDTO {
	@ApiProperty({ type: () => Number, minimum: 0, description: 'The ceiling that remains after the reduction.' })
	@IsNotEmpty()
	@IsInt()
	@Min(0)
	readonly quantity: number;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly reason?: string;
}
