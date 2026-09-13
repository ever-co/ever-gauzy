import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { PayrollItem } from '../payroll-item.entity';

export class MikroOrmPayrollItemRepository extends MikroOrmBaseEntityRepository<PayrollItem> {}
