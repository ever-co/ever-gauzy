import { Repository } from 'typeorm';
import { Timesheet } from '../timesheet.entity';

export class TypeOrmTimesheetRepository extends Repository<Timesheet> { }