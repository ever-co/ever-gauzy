import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { DailyPlanTask } from '../daily-plan-task.entity';

export class MikroOrmDailyPlanTaskRepository extends MikroOrmBaseEntityRepository<DailyPlanTask> {}
