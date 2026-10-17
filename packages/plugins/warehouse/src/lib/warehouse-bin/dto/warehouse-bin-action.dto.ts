import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';
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

/**
 * One home-bin declaration.
 *
 * A declaration, not a move: the operator states where the stock is expected to be, the level row's home
 * bin is written, and no movement is recorded because nothing physically changed. When the declaration
 * disagrees with the placement, reconciliation reports it and the operator either moves the units or
 * re-declares the bin.
 */
export class AssignWarehouseBinDTO {
	@ApiProperty({ type: () => String, description: 'The variant the declaration is about.' })
	@IsNotEmpty()
	@IsUUID()
	readonly variantId: ID;

	@ApiProperty({ type: () => String, description: 'The location that stocks it.' })
	@IsNotEmpty()
	@IsUUID()
	readonly warehouseId: ID;

	@ApiPropertyOptional({ type: () => String, description: 'The level row, when the caller has it.' })
	@IsOptional()
	@IsUUID()
	readonly levelId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Why the address was declared.' })
	@IsOptional()
	@IsString()
	readonly reason?: string;
}

/**
 * One put-away: the walk received units take from where they were dropped into a bin.
 *
 * `fromBinId` is stated only when the units were recorded in the receiving area's own bin — a receipt
 * that landed in the location rather than at an address has no leg to leave, and stating one would
 * subtract stock the ledger does not hold at that bin.
 */
export class PutAwayWarehouseBinDTO {
	@ApiProperty({ type: () => String, description: 'The variant being placed.' })
	@IsNotEmpty()
	@IsUUID()
	readonly variantId: ID;

	@ApiProperty({ type: () => String, description: 'The location the units are already in.' })
	@IsNotEmpty()
	@IsUUID()
	readonly warehouseId: ID;

	@ApiProperty({ type: () => String, description: 'The quantity being placed, as an exact decimal string.' })
	@IsNotEmpty()
	@IsNumberString()
	readonly quantity: string;

	@ApiPropertyOptional({ type: () => String, description: 'The bin the units walk from, when they are in one.' })
	@IsOptional()
	@IsUUID()
	readonly fromBinId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'The movement the units were received by.' })
	@IsOptional()
	@IsUUID()
	readonly stockMovementId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'The row that asked for the walk.' })
	@IsOptional()
	@IsUUID()
	readonly referenceId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Why the units were placed there.' })
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

/**
 * One capacity measurement.
 *
 * The quantity is an exact decimal string, and `conversionFactor` is how many of the capacity's units
 * one of the request's units is — the same orientation `unit.factor` carries. Supplying it is what
 * lets a request entered in pieces be compared with a capacity declared in pallets; omitting it
 * compares the two numbers as though they were the same unit, which is the reading every bin had
 * before the capacity's unit existed.
 */
export class CheckWarehouseBinCapacityDTO {
	@ApiProperty({ type: () => String, description: 'The bin whose capacity is being measured against.' })
	@IsNotEmpty()
	@IsUUID()
	readonly binId: ID;

	@ApiProperty({ type: () => String, description: 'The requested quantity, as an exact decimal string.' })
	@IsNotEmpty()
	@IsNumberString()
	readonly quantity: string;

	@ApiPropertyOptional({ type: () => String, description: 'The unit the quantity was entered in.' })
	@IsOptional()
	@IsUUID()
	readonly unitId?: ID;

	@ApiPropertyOptional({
		type: () => String,
		description: 'How many of the capacity’s units one of the request’s units is; one when omitted.'
	})
	@IsOptional()
	@IsNumberString()
	readonly conversionFactor?: string;
}
