/**
 * Delete a task from many / all daily plans
 */

import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
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

	@ApiPropertyOptional({
		type: () => String,
		example: '2024-01-01',
		description: "The caller's current day. Plans dated before it keep the task. Defaults to the UTC date."
	})
	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	readonly today?: string;
}
