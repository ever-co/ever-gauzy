import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { ID } from '@gauzy/contracts';

/** One line as the counter reads it. */
export class StockCountLineInputDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	lineId: ID;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	countedQuantity: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	note?: string;
}

/**
 * Record counted quantities request DTO validation.
 *
 * A whole sheet arrives in one call. Posting it line by line would leave a session half-recorded
 * whenever a counter’s device lost its connection, and the session’s own progress counters are
 * recomputed from the lines on every batch.
 */
export class RecordStockCountLinesDTO {
	@ApiProperty({ type: () => Array, isArray: true })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => StockCountLineInputDTO)
	lines: StockCountLineInputDTO[];
}
