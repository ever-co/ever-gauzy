import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsUUID, Min, ValidateNested } from 'class-validator';
import { ID } from '@gauzy/contracts';

/** One line as it is dispatched. A negative quantity is refused here and by the service alike. */
export class StockTransferShipLineDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	lineId: ID;

	@ApiProperty({ type: () => Number, minimum: 0 })
	@IsNumber()
	@Min(0)
	shippedQuantity: number;
}

/**
 * Ship request DTO validation.
 *
 * Only the lines that actually leave are named: a line left out of the request has not shipped, which
 * is a different fact from having shipped zero and is recorded as such.
 */
export class ShipStockTransferDTO {
	@ApiProperty({ type: () => Array, isArray: true })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => StockTransferShipLineDTO)
	lines: StockTransferShipLineDTO[];
}
