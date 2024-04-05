import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoalGeneralSetting } from '../goal-general-setting.entity';

@Injectable()
export class TypeOrmGoalGeneralSettingRepository extends Repository<GoalGeneralSetting> {
    constructor(@InjectRepository(GoalGeneralSetting) readonly repository: Repository<GoalGeneralSetting>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
