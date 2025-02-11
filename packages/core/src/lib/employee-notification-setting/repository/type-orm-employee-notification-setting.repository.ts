import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeNotificationSetting } from '../employee-notification-setting.entity';

@Injectable()
export class TypeOrmEmployeeNotificationSettingRepository extends Repository<EmployeeNotificationSetting> {
	constructor(
		@InjectRepository(EmployeeNotificationSetting) readonly repository: Repository<EmployeeNotificationSetting>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
