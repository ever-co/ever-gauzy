import { ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IOrganizationProjectSetting } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { OrganizationProject } from '../organization-project.entity';

export class UpdateProjectSettingDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		PickType(OrganizationProject, ['isTasksAutoSync', 'isTasksAutoSyncOnLabel', 'syncTag'] as const)
	)
	implements IOrganizationProjectSetting
{
	/*
	|--------------------------------------------------------------------------
	| Embeddable Columns
	|--------------------------------------------------------------------------
	*/
	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	readonly customFields?: Record<string, any>;
}
