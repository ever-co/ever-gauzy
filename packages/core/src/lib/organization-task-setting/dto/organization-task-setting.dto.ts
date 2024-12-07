import { IOrganizationTaskSetting, } from '@gauzy/contracts';
import { IntersectionType, OmitType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { OrganizationTaskSetting } from './../organization-task-setting.entity';

export class OrganizationTaskSettingDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	OmitType(OrganizationTaskSetting, ['organizationId', 'organization'])
) implements IOrganizationTaskSetting { }
