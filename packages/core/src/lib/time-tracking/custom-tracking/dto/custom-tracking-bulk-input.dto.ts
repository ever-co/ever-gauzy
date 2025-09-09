import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { IProcessTrackingDataBulkInput } from '@gauzy/contracts';
import { ProcessTrackingDataDTO } from './process-tracking-data.dto';

/**
 * DTO for bulk custom tracking data submission
 */
export class CustomTrackingBulkInputDTO implements IProcessTrackingDataBulkInput {
	@ApiProperty({ 
		type: () => Array, 
		required: true,
		description: 'Array of custom tracking data entries to process in bulk'
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ProcessTrackingDataDTO)
	readonly list: ProcessTrackingDataDTO[];
}
