import { EntityRepository } from '@mikro-orm/knex';
import { Report } from '../report.entity';

export class MikroOrmReportRepository extends EntityRepository<Report> { }
