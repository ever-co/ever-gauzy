import { Repository } from 'typeorm';
import { ReportCategory } from '../report-category.entity';

export class TypeOrmReportCategoryRepository extends Repository<ReportCategory> { }
