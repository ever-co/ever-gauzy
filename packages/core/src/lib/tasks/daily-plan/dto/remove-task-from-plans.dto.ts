/**
 * Delete a task from many / all daily plans
 */

import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IDailyPlan, IDailyPlansTasksUpdateInput, IEmployee } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

export class RemoveTaskFromManyPlansDTO
	extends IntersectionType(TenantOrganizationBaseDTO)
	implements IDailyPlansTasksUpdateInput
{
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly employeeId?: IEmployee['id'];

	@ApiProperty({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	plansIds: IDailyPlan['id'][];
}
