import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EmployeeSettingService } from './employee-setting.service';
import { EmployeeSetting } from './employee-setting.entity';
import { CrudController } from './../core/crud';
import { TenantPermissionGuard } from './../shared/guards';

@ApiTags('EmployeeSetting')
@UseGuards(TenantPermissionGuard)
@Controller()
export class EmployeeSettingController extends CrudController<EmployeeSetting> {
	constructor(private readonly employeeSettingService: EmployeeSettingService) {
		super(employeeSettingService);
	}
}
