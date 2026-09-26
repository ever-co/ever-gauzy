import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * One line of a return, as a caller sees it.
 *
 * `receivedQuantity` and `damagedQuantity` are read-only in practice: they are written by the
 * receiving action, which is the only thing that knows what physically arrived.
 */
export class OrderReturnLineDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly returnId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderLineId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly quantity?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly receivedQuantity?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly damagedQuantity?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly reasonId?: ID;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	readonly restock?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly note?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	readonly metadata?: Record<string, unknown>;
}
