import { EntityRepository } from '@mikro-orm/core';
import { GoalKPITemplate } from '../goal-kpi-template.entity';

export class MikroOrmGoalKpiTemplateRepository extends EntityRepository<GoalKPITemplate> { }
