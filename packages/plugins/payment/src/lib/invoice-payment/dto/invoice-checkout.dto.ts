import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Where the provider sends the client back once they paid or gave up. */
export class InvoiceCheckoutDTO {
	@ApiProperty({
		type: () => String,
		description: 'The public page of the invoice, on a front end of this deployment.'
	})
	@IsNotEmpty()
	@IsString()
	@MaxLength(2048)
	readonly returnUrl: string;
}
