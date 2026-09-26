import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import {
	CommissionBasis,
	CommissionOn,
	CurrencyCode,
	DecimalString,
	ID,
	SellerHoldReason,
	SellerTransactionKind,
	SellerTransactionStatus
} from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * A ledger row as the API accepts it.
 *
 * The monetary columns are present because the row is written by the order split, which runs inside the
 * order's own transaction and passes the amounts it computed — never because a caller may set them.
 * The read and settle endpoints accept only the status-bearing fields, and the service ignores any
 * amount it is handed on those paths: a ledger that a request body could move is not a ledger.
 */
export class SellerTransactionDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly sellerId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderLineId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderTransactionId?: ID;

	@ApiPropertyOptional({ type: () => String, enum: SellerTransactionKind })
	@IsOptional()
	@IsEnum(SellerTransactionKind)
	readonly kind?: SellerTransactionKind;

	@ApiPropertyOptional({ type: () => String, enum: SellerTransactionStatus })
	@IsOptional()
	@IsEnum(SellerTransactionStatus)
	readonly status?: SellerTransactionStatus;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	readonly currency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly currencyDecimals?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly grossAmount?: DecimalString;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly taxAmount?: DecimalString;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly sellerDiscountAmount?: DecimalString;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly platformDiscountAmount?: DecimalString;

	@ApiPropertyOptional({ type: () => String, enum: CommissionBasis })
	@IsOptional()
	@IsEnum(CommissionBasis)
	readonly commissionBasis?: CommissionBasis;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly commissionBasisAmount?: DecimalString;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly commissionRate?: DecimalString;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly commissionAmount?: DecimalString;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly netAmount?: DecimalString;

	@ApiPropertyOptional({ type: () => String, enum: CommissionOn })
	@IsOptional()
	@IsEnum(CommissionOn)
	readonly commissionOn?: CommissionOn;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly occurredAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly settleableAt?: Date;

	@ApiPropertyOptional({ type: () => String, enum: SellerHoldReason })
	@IsOptional()
	@IsEnum(SellerHoldReason)
	readonly holdReason?: SellerHoldReason;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly reversesTransactionId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly refundId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly description?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	readonly metadata?: Record<string, any>;
}
