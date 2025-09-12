import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { IProcessTrackingDataBulkInput } from '@gauzy/contracts';
import { ProcessTrackingDataDTO } from './process-tracking-data.dto';

/**
 * DTO for bulk custom tracking data submission
 */
export class CustomTrackingBulkInputDTO implements IProcessTrackingDataBulkInput {
	@ApiProperty({
		type: () => ProcessTrackingDataDTO,
		isArray: true,
		required: true,
		description: 'Array of custom tracking data entries to process in bulk'
	})
	@IsArray()
	@ArrayNotEmpty()
	@ValidateNested({ each: true })
	@Type(() => ProcessTrackingDataDTO)
	readonly items: ProcessTrackingDataDTO[];
}
