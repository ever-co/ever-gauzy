import { Repository } from 'typeorm';
import { GoalGeneralSetting } from '../goal-general-setting.entity';

export class TypeOrmGoalGeneralSettingRepository extends Repository<GoalGeneralSetting> { }