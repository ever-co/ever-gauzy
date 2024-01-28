import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeSetting } from './employee-setting.entity';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class EmployeeSettingService extends TenantAwareCrudService<EmployeeSetting> {
	constructor(
		@InjectRepository(EmployeeSetting)
		employeeSettingRepository: Repository<EmployeeSetting>,
		@MikroInjectRepository(EmployeeSetting)
		mikroEmployeeSettingRepository: EntityRepository<EmployeeSetting>
	) {
		super(employeeSettingRepository, mikroEmployeeSettingRepository);
	}
}
