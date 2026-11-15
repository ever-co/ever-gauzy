import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { InvoiceScheduleRun } from '../invoice-schedule-run.entity';

export class MikroOrmInvoiceScheduleRunRepository extends MikroOrmBaseEntityRepository<InvoiceScheduleRun> {}
