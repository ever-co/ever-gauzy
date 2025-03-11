import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';

export class GetHourlyRateDto {
	@ApiProperty({ description: 'Organization ID', type: String })
	@IsUUID()
	readonly organizationId: ID;

	@ApiProperty({ description: 'List of employee UUIDs', type: [String] })
	@IsArray()
	@IsNotEmpty()
	@IsUUID(undefined, { each: true })
	employeeIds: ID[];

	@ApiProperty({ description: 'Range start date', type: Date })
	@IsNotEmpty()
	startDate: Date;

	@ApiProperty({ description: 'Range end date', type: Date })
	@IsNotEmpty()
	endDate: Date;
}
