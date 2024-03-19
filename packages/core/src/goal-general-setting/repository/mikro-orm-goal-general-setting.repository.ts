import { EntityRepository } from '@mikro-orm/knex';
import { GoalGeneralSetting } from '../goal-general-setting.entity';

export class MikroOrmGoalGeneralSettingRepository extends EntityRepository<GoalGeneralSetting> { }
