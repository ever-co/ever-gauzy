import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeSetting } from './employee-setting.entity';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class EmployeeSettingService extends TenantAwareCrudService<EmployeeSetting> {
	constructor(
		@InjectRepository(EmployeeSetting)
		private readonly employeeSettingRepository: Repository<EmployeeSetting>
	) {
		super(employeeSettingRepository);
	}
}
