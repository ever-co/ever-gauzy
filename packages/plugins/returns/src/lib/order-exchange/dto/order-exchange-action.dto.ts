import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/** The body of `POST /order-exchanges/:id/approve`. */
export class ApproveOrderExchangeDTO {
	@ApiPropertyOptional({
		type: () => Boolean,
		default: true,
		description: 'Whether the priced difference should be settled against the payment collection when the operation runs.'
	})
	@IsOptional()
	@IsBoolean()
	readonly settleDifference?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/** The body of every exchange action that only needs a reason. */
export class ReasonedOrderExchangeActionDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly reason?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/** One outbound line as an operator edits an exchange's line set. */
export class EditOrderExchangeLineDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly orderLineId?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	readonly variantId: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	readonly quantity?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly unitPrice?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/** The body of `PUT /order-exchanges/:id`. */
export class EditOrderExchangeDTO {
	@ApiPropertyOptional({ type: () => [EditOrderExchangeLineDTO] })
	@IsOptional()
	readonly lines?: EditOrderExchangeLineDTO[];

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly allowBackorder?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}
