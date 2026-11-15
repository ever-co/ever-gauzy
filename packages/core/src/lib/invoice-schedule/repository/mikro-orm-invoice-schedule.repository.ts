import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { InvoiceSchedule } from '../invoice-schedule.entity';

export class MikroOrmInvoiceScheduleRepository extends MikroOrmBaseEntityRepository<InvoiceSchedule> {}
