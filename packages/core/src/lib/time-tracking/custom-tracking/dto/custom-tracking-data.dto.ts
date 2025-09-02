import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDateString, IsOptional } from 'class-validator';

/**
 * DTO for submitting custom tracking data
 */
export class CustomTrackingDataDTO {
	/**
	 * Encoded tracking data from the frontend
	 */
	@ApiProperty({
		type: () => String,
		description: 'Encoded tracking data from the frontend tracking system'
	})
	@IsNotEmpty()
	@IsString()
	readonly trackingData: string;

	/**
	 * Timestamp when the data was captured
	 */
	@ApiProperty({
		type: () => String,
		description: 'Timestamp when the tracking data was captured'
	})
	@IsNotEmpty()
	@IsDateString()
	readonly timestamp: string;

	/**
	 * Optional metadata about the tracking session
	 */
	@ApiPropertyOptional({
		type: () => Object,
		description: 'Optional metadata about the tracking session'
	})
	@IsOptional()
	readonly metadata?: Record<string, unknown>;
}
