import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmEmployeeSettingRepository } from './repository/type-orm-employee-setting.repository';
import { MikroOrmEmployeeSettingRepository } from './repository/mikro-orm-employee-setting.repository';
import { EmployeeSetting } from './employee-setting.entity';

@Injectable()
export class EmployeeSettingService extends TenantAwareCrudService<EmployeeSetting> {
	constructor(
		@InjectRepository(EmployeeSetting)
		typeOrmEmployeeSettingRepository: TypeOrmEmployeeSettingRepository,

		mikroOrmEmployeeSettingRepository: MikroOrmEmployeeSettingRepository
	) {
		super(typeOrmEmployeeSettingRepository, mikroOrmEmployeeSettingRepository);
	}
}
