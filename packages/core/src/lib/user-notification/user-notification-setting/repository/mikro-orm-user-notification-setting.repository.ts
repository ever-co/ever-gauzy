import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { UserNotificationSetting } from '../user-notification-setting.entity';

export class MikroOrmUserNotificationSettingRepository extends MikroOrmBaseEntityRepository<UserNotificationSetting> {}
