import { IOrganizationTaskSetting } from '@gauzy/contracts';
import { IntersectionType } from '@nestjs/swagger';
import { OrganizationTaskSettingDTO } from './organization-task-setting.dto';

export class CreateOrganizationTaskSettingDTO
	extends IntersectionType(OrganizationTaskSettingDTO)
	implements IOrganizationTaskSetting {}
