import { EntityRepository } from '@mikro-orm/core';
import { GoalKPITemplate } from '../goal-kpi-template.entity';

export class MikroOrmGoalKPITemplateRepository extends EntityRepository<GoalKPITemplate> { }
