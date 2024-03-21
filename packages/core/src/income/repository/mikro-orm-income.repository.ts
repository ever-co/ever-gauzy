import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Income } from '../income.entity';

export class MikroOrmIncomeRepository extends MikroOrmBaseEntityRepository<Income> { }
