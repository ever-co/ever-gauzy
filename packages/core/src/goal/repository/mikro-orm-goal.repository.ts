import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Goal } from '../goal.entity';

export class MikroOrmGoalRepository extends MikroOrmBaseEntityRepository<Goal> { }
