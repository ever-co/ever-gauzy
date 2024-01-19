import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { GoalGeneralSetting } from './goal-general-setting.entity';
import { TenantAwareCrudService } from './../core/crud';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class GoalGeneralSettingService extends TenantAwareCrudService<GoalGeneralSetting> {
	constructor(
		@InjectRepository(GoalGeneralSetting)
		private readonly goalGeneralSettingRepository: Repository<GoalGeneralSetting>,
		@MikroInjectRepository(GoalGeneralSetting)
		private readonly mikroGoalGeneralSettingRepository: EntityRepository<GoalGeneralSetting>
	) {
		super(goalGeneralSettingRepository, mikroGoalGeneralSettingRepository);
	}
}
