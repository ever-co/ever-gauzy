import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { OrderExchangeLineDTO } from './order-exchange-line.dto';

/**
 * An outbound exchange line created on its own, when an operator extends an exchange that is still
 * open. The unit price is supplied here because the line is written directly rather than priced by
 * the resolution step.
 */
export class CreateOrderExchangeLineDTO extends OrderExchangeLineDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly exchangeId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly variantId: ID;

	@ApiProperty({ type: () => String, description: 'Exact decimal string, e.g. "1.000000".' })
	@IsNotEmpty()
	readonly quantity: string;

	@ApiProperty({ type: () => String, description: 'Exact decimal string, e.g. "19.990000".' })
	@IsNotEmpty()
	readonly unitPrice: string;
}
