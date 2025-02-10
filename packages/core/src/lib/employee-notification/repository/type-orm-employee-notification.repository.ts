import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeNotification } from '../employee-notification.entity';

@Injectable()
export class TypeOrmEmployeeNotificationRepository extends Repository<EmployeeNotification> {
	constructor(@InjectRepository(EmployeeNotification) readonly repository: Repository<EmployeeNotification>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
