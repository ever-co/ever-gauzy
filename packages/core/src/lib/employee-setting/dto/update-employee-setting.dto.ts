import { IntersectionType, OmitType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { CreateEmployeeSettingDTO } from './create-employee-setting.dto';

export class UpdateEmployeeSettingDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	OmitType(CreateEmployeeSettingDTO, ['employee', 'employeeId'])
) {}
