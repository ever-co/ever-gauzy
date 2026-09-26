import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { StockTransferDTO } from './stock-transfer.dto';

/** One variant being moved, as a caller states it when the transfer is drafted. */
export class StockTransferLineInputDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsUUID()
	variantId: ID;

	@ApiPropertyOptional({ type: () => Number })
	@IsNumber()
	requestedQuantity: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	unitCost?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	note?: string;
}

/**
 * Create stock transfer request DTO validation.
 *
 * The document is drafted with its lines in one call, because a transfer with no lines is a document
 * that says nothing and a second round trip to fill it is a chance to forget.
 */
export class CreateStockTransferDTO extends StockTransferDTO {
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => StockTransferLineInputDTO)
	lines?: StockTransferLineInputDTO[];
}
