import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { DailyPlanStatusEnum, ID, IDailyPlanCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { EmployeeFeatureDTO } from '../../../employee/dto';
import { OrganizationTeamFeatureDTO } from '../../../organization-team/dto';

/**
 * Create Daily Plan DTO validation
 */
export class CreateDailyPlanDTO
	extends IntersectionType(TenantOrganizationBaseDTO, EmployeeFeatureDTO, OrganizationTeamFeatureDTO)
	implements IDailyPlanCreateInput
{
	@ApiProperty({ type: () => Date })
	@Type(() => Date)
	@IsNotEmpty()
	@IsDate()
	readonly date: Date;

	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	readonly workTimePlanned: number;

	@ApiProperty({ type: () => String, enum: DailyPlanStatusEnum })
	@IsNotEmpty()
	@IsEnum(DailyPlanStatusEnum, { message: 'status `$value` must be a valid enum value' })
	readonly status: DailyPlanStatusEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly taskId?: ID;
}
