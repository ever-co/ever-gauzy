import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { IProcessTrackingDataBulkInput, ITrackingSession } from '@gauzy/contracts';
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
	readonly list: ProcessTrackingDataDTO[];
}

export type BulkProcessResult = {
	success: boolean;
	sessionId: string;
	timeSlotId: string;
	message: string;
	session: ITrackingSession | null;
	index: number;
	error?: string;
};
