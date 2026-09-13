import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { PayrollRun } from '../payroll-run.entity';

export class MikroOrmPayrollRunRepository extends MikroOrmBaseEntityRepository<PayrollRun> {}
