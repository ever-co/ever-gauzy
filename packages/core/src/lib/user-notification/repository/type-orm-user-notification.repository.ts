import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserNotification } from '../user-notification.entity';

@Injectable()
export class TypeOrmUserNotificationRepository extends Repository<UserNotification> {
	constructor(@InjectRepository(UserNotification) readonly repository: Repository<UserNotification>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
