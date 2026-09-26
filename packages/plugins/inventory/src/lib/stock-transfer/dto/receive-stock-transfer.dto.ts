import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { ID } from '@gauzy/contracts';

/** One line as it is received. */
export class StockTransferReceiveLineDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	lineId: ID;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	receivedQuantity: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	damagedQuantity?: number;
}

/**
 * Receive request DTO validation.
 *
 * Received and damaged are separate numbers rather than one, because units that arrived broken did
 * arrive: they are on site, they are not sellable, and recording them as a shortfall would lose the
 * fact that the carrier delivered them.
 */
export class ReceiveStockTransferDTO {
	@ApiProperty({ type: () => Array, isArray: true })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => StockTransferReceiveLineDTO)
	lines: StockTransferReceiveLineDTO[];
}
