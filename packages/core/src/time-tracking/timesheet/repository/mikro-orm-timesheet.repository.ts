import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { Timesheet } from '../timesheet.entity';

export class MikroOrmTimesheetRepository extends MikroOrmBaseEntityRepository<Timesheet> { }
