import { EntityRepository } from '@mikro-orm/knex';
import { Timesheet } from '../timesheet.entity';

export class MikroOrmTimesheetRepository extends EntityRepository<Timesheet> { }
