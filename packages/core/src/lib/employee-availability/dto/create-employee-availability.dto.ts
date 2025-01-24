import { IsUUID, IsDateString, IsEnum, IsOptional, IsString, IsInt } from 'class-validator';
import { AvailabilityStatusEnum, ID, IEmployeeAvailabilityCreateInput } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '../../core/dto/tenant-organization-base.dto';

export class CreateEmployeeAvailabilityDTO
	extends TenantOrganizationBaseDTO
	implements IEmployeeAvailabilityCreateInput
{
	@ApiProperty({ type: () => String })
	@IsUUID()
	employeeId: ID;

	@ApiProperty({ type: () => Date })
	@IsDateString()
	startDate: Date;

	@ApiProperty({ type: () => Date })
	@IsDateString()
	endDate: Date;

	@ApiProperty({ type: () => Number })
	@IsInt()
	dayOfWeek: number;

	@ApiProperty({ enum: AvailabilityStatusEnum })
	@IsEnum(AvailabilityStatusEnum)
	availabilityStatus: AvailabilityStatusEnum;

	@ApiPropertyOptional({
		type: () => String
	})
	@IsOptional()
	@IsString()
	availabilityNotes?: string;
}
