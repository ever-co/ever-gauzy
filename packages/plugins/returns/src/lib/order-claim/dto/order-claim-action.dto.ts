import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/** The body of `POST /order-claims/:id/approve`. */
export class ApproveOrderClaimDTO {
	@ApiPropertyOptional({
		type: () => String,
		description: 'Exact decimal refund to issue; required for a refund claim and ignored for a replacement.'
	})
	@IsOptional()
	@IsString()
	readonly refundAmount?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/** The body of every claim action that only needs a reason. */
export class ReasonedOrderClaimActionDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly reason?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/** One claimed line as an operator edits a claim's line set. */
export class EditOrderClaimLineDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly orderLineId?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly variantId?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	readonly quantity?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly reason?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isAdditionalItem?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/** The body of `PUT /order-claims/:id`. */
export class EditOrderClaimDTO {
	@ApiPropertyOptional({ type: () => [EditOrderClaimLineDTO] })
	@IsOptional()
	readonly lines?: EditOrderClaimLineDTO[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly reason?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}
