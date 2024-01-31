import { EntityRepository } from '@mikro-orm/core';
import { GoalGeneralSetting } from '../goal-general-setting.entity';

export class MikroOrmGoalGeneralSettingRepository extends EntityRepository<GoalGeneralSetting> { }