import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { IUserNotificationSetting } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../../core/crud';
import { RequestContext } from '../../core/context';
import { UserNotificationSetting } from './user-notification-setting.entity';
import { TypeOrmUserNotificationSettingRepository } from './repository/type-orm-user-notification-setting.repository';
import { MikroOrmUserNotificationSettingRepository } from './repository/mikro-orm-user-notification-setting.repository';

@Injectable()
export class UserNotificationSettingService extends TenantAwareCrudService<UserNotificationSetting> {
	constructor(
		readonly typeOrmUserNotificationSettingRepository: TypeOrmUserNotificationSettingRepository,
		readonly mikroOrmUserNotificationSettingRepository: MikroOrmUserNotificationSettingRepository
	) {
		super(typeOrmUserNotificationSettingRepository, mikroOrmUserNotificationSettingRepository);
	}

	/**
	 * Creates an user notification setting record
	 *
	 * @param {IUserNotificationSetting} input - The input data for creating a notification setting
	 * @returns {Promise<UserNotificationSetting>} The created notification setting
	 */
	async create(input: IUserNotificationSetting): Promise<UserNotificationSetting> {
		try {
			const userId = input.userId || RequestContext.currentUserId();
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			return super.create({ ...input, userId, tenantId });
		} catch (error) {
			throw new HttpException(
				`Failed to create the notification setting: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
	}
}
