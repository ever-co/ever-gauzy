import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { OrderReturnLineDTO } from './order-return-line.dto';

/**
 * A return line as a caller creates it: it says what is coming back and how it should be handled.
 */
export class CreateOrderReturnLineDTO extends OrderReturnLineDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly returnId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly orderLineId: ID;

	@ApiProperty({ type: () => String, description: 'Exact decimal string, e.g. "2.000000".' })
	@IsNotEmpty()
	readonly quantity: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: ID;
}
