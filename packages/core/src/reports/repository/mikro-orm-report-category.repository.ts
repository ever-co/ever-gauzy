import { EntityRepository } from '@mikro-orm/core';
import { ReportCategory } from '../report-category.entity';

export class MikroOrmReportCategoryRepository extends EntityRepository<ReportCategory> { }
