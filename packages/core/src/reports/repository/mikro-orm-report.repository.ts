import { EntityRepository } from '@mikro-orm/core';
import { Report } from '../report.entity';

export class MikroOrmReportRepository extends EntityRepository<Report> { }
