import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrencyCode, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PurchaseOrderStatus } from '../../purchasing.types';

/**
 * A purchase order as a caller sees it.
 *
 * Amounts are strings, never numbers: the columns behind them are exact decimals and a JSON number
 * would lose the exactness on the way in. `number`, `status`, `version` and the derived totals are
 * service-owned — readable, and not settable by a client.
 */
export class PurchaseOrderDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly number?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly vendorId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 64, description: "The supplier's own order number." })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly vendorReference?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Who owns the order. Defaults to the caller.' })
	@IsOptional()
	@IsUUID()
	readonly buyerUserId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly paymentTermId?: ID;

	@ApiPropertyOptional({ type: () => Number, description: 'The simple settlement form, in days, as snapshotted.' })
	@IsOptional()
	@IsInt()
	readonly paymentTermsDaysSnapshot?: number;

	@ApiPropertyOptional({ type: () => Date, description: 'When the order falls due, snapshotted at order time.' })
	@IsOptional()
	readonly dueDate?: Date;

	@ApiPropertyOptional({ type: () => String, enum: PurchaseOrderStatus })
	@IsOptional()
	@IsEnum(PurchaseOrderStatus)
	readonly status?: PurchaseOrderStatus;

	@ApiPropertyOptional({ type: () => String, maxLength: 3 })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	readonly currency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "1250.000000".' })
	@IsOptional()
	@IsString()
	readonly subtotal?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string.' })
	@IsOptional()
	@IsString()
	readonly discountTotal?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string.' })
	@IsOptional()
	@IsString()
	readonly taxTotal?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string.' })
	@IsOptional()
	@IsString()
	readonly shippingTotal?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string.' })
	@IsOptional()
	@IsString()
	readonly grandTotal?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly expectedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly orderedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly receivedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly sentAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly acknowledgedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly approvedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly approvedByUserId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly approvalId?: ID;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly canceledAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly closedAt?: Date;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly version?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}

/**
 * The order's allocated number, as the service produced it.
 */
export class PurchaseOrderNumberDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly number: string;
}
