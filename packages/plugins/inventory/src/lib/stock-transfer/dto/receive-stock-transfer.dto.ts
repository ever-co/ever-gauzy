import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * One line as it is received. Both quantities count units that arrived, so neither may be negative
 * (review R2-03); the service refuses the same values for the GraphQL mutation, which has no DTO.
 */
export class StockTransferReceiveLineDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	lineId: ID;

	@ApiProperty({ type: () => Number, minimum: 0 })
	@IsNumber()
	@Min(0)
	receivedQuantity: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsNumber()
	@Min(0)
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
