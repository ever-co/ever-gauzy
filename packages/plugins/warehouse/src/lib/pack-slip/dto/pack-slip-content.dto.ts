import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * What sealing a slip records.
 *
 * The weight, the volume and the tracking number are stated here rather than derived, because they are
 * what the bench measured and what the carrier issued — the two facts a later dispute is settled with.
 */
export class PackSlipContentDTO {
	@ApiProperty({ type: () => Number, minimum: 1, description: 'How many parcels the packing produced.' })
	@IsNotEmpty()
	@IsInt()
	@Min(1)
	readonly packageCount: number;

	@ApiPropertyOptional({ type: () => String, description: 'Packed items plus packaging, e.g. "2.4500".' })
	@IsOptional()
	@IsNumberString()
	readonly totalWeight?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Total volume, e.g. "0.1200".' })
	@IsOptional()
	@IsNumberString()
	readonly totalVolume?: string;

	@ApiPropertyOptional({ type: () => String, description: 'The shipping provider that will carry the package.' })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly carrierKey?: string;

	@ApiPropertyOptional({ type: () => String, description: 'The tracking number the carrier issued.' })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly trackingNumber?: string;

	@ApiPropertyOptional({ type: () => String, description: 'The stored label document.' })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	readonly labelUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/** Why a slip was cancelled. */
export class CancelPackSlipDTO {
	@ApiPropertyOptional({ type: () => String, description: 'Why the slip was abandoned before packing.' })
	@IsOptional()
	@IsString()
	readonly reason?: string;
}
