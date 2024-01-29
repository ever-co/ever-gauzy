import { EntityRepository } from '@mikro-orm/core';
import { Timesheet } from '../timesheet.entity';

export class MikroOrmTimesheetRepository extends EntityRepository<Timesheet> { }