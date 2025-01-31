import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserNotificationSetting } from '../user-notification-setting.entity';

@Injectable()
export class TypeOrmUserNotificationSettingRepository extends Repository<UserNotificationSetting> {
	constructor(@InjectRepository(UserNotificationSetting) readonly repository: Repository<UserNotificationSetting>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
