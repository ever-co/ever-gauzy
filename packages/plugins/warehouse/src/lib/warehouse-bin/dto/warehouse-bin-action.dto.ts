import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * A move of a bin inside its zone.
 *
 * The target must be in the same zone, cannot be the bin itself and cannot be inside the bin's own
 * subtree; the service checks all three against the closure table before it writes, because a cycle
 * would make every later descendant query non-terminating rather than merely wrong.
 */
export class ReparentWarehouseBinDTO {
	@ApiProperty({ type: () => String, nullable: true, description: 'The new parent, or null to make it a root.' })
	@IsOptional()
	@IsUUID()
	readonly parentId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Why the position moved.' })
	@IsOptional()
	@IsString()
	readonly reason?: string;
}

/** Why a bin was taken out of service, or put back into it. */
export class BlockWarehouseBinDTO {
	@ApiPropertyOptional({ type: () => String, description: 'Why the position was blocked or unblocked.' })
	@IsOptional()
	@IsString()
	readonly reason?: string;
}

/** One bin-scoped reconciliation request. */
export class ReconcileWarehouseBinDTO {
	@ApiProperty({ type: () => String, description: 'The location that is being reconciled.' })
	@IsNotEmpty()
	@IsUUID()
	readonly warehouseId: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Reconcile one area instead of the whole location.' })
	@IsOptional()
	@IsUUID()
	readonly zoneId?: ID;

	@ApiPropertyOptional({
		type: () => [String],
		description: 'Reconcile these bins instead of every bin of the location.'
	})
	@IsOptional()
	readonly binIds?: ID[];

	@ApiPropertyOptional({
		type: () => Boolean,
		default: false,
		description: 'Write the correcting movements, or report the drift and leave the decision to an operator.'
	})
	@IsOptional()
	readonly repair?: boolean;
}
