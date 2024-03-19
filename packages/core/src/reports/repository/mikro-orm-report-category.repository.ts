import { EntityRepository } from '@mikro-orm/knex';
import { ReportCategory } from '../report-category.entity';

export class MikroOrmReportCategoryRepository extends EntityRepository<ReportCategory> { }
