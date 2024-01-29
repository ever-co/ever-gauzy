import { EntityRepository } from '@mikro-orm/core';
import { Report } from '../report.entity';

export class MikroOrmReportsRepository extends EntityRepository<Report> { }
