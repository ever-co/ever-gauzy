import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { OrderClaimLineDTO } from './order-claim-line.dto';

/**
 * A claim line created on its own, when an operator extends a claim that is still open.
 */
export class CreateOrderClaimLineDTO extends OrderClaimLineDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly claimId: ID;

	@ApiProperty({ type: () => String, description: 'Exact decimal string, e.g. "1.000000".' })
	@IsNotEmpty()
	readonly quantity: string;
}
