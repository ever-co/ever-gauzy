import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** What an organization's settings write to connect its payment connector. */
export class InvoicePaymentConnectionDTO {
	@ApiProperty({ type: () => String, description: 'The HTTPS endpoint of the connector that opens checkouts.' })
	@IsNotEmpty()
	@IsString()
	@MaxLength(2048)
	readonly checkoutEndpoint: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isEnabled?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isTestMode?: boolean;
}
