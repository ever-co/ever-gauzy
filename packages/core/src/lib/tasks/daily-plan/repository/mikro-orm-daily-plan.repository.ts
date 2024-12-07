import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { DailyPlan } from '../daily-plan.entity';

export class MikroOrmDailyPlanRepository extends MikroOrmBaseEntityRepository<DailyPlan> {}
