import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';

/** The body of a list-level transition: assign, start, complete or cancel. */
export class PickListActionDTO {
	@ApiPropertyOptional({ type: () => String, description: 'The picker the list is assigned to.' })
	@IsOptional()
	@IsUUID()
	readonly assignedToUserId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Why the list was cancelled.' })
	@IsOptional()
	@IsString()
	readonly reason?: string;
}

/**
 * What the picker recorded against one line.
 *
 * `pickedQuantity` at or below `quantityRequested` closes the line `PICKED`; below it closes the line
 * `SHORT`, and the missing quantity is corrected through the inventory capability in the same
 * transaction — a bin that held less than the list asked for is a stock error and the ledger has to
 * learn about it.
 */
export class PickListLineOutcomeDTO {
	@ApiPropertyOptional({
		type: () => String,
		description: 'What was actually taken, as an exact decimal string, e.g. "2.000000".'
	})
	@IsOptional()
	@IsString()
	readonly pickedQuantity?: string;

	@ApiPropertyOptional({ type: () => String, description: 'The bin it was taken from, when it changed.' })
	@IsOptional()
	@IsUUID()
	readonly binId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'The lot or batch scanned at picking.' })
	@IsOptional()
	@IsString()
	readonly lotNumber?: string;

	@ApiPropertyOptional({ type: () => [String], description: 'The serials scanned at picking.' })
	@IsOptional()
	readonly serialNumbers?: string[];

	@ApiPropertyOptional({ type: () => String, description: 'Why the line was closed short or skipped.' })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/**
 * What the picker substituted.
 *
 * The substitute is recorded on the line; the price difference it may imply belongs to the order
 * change that authorises the substitution, so no money is computed here.
 */
export class PickListLineSubstitutionDTO {
	@ApiPropertyOptional({ type: () => String, description: 'The variant actually taken.' })
	@IsOptional()
	@IsUUID()
	readonly substituteVariantId?: ID;

	@ApiPropertyOptional({
		type: () => String,
		description: 'How much of the substitute was taken, e.g. "1.000000".'
	})
	@IsOptional()
	@IsString()
	readonly substituteQuantity?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Why the substitute is acceptable.' })
	@IsOptional()
	@IsString()
	readonly substitutionReason?: string;

	@ApiPropertyOptional({ type: () => String, description: 'The bin the substitute was taken from.' })
	@IsOptional()
	@IsUUID()
	readonly binId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}
