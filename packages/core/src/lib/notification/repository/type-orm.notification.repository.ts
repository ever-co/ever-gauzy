import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../notification.entity';

@Injectable()
export class TypeOrmNotificationRepository extends Repository<Notification> {
	constructor(@InjectRepository(Notification) readonly repository: Repository<Notification>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
