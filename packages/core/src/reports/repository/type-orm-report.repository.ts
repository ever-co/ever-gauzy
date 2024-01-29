import { Repository } from 'typeorm';
import { Report } from '../report.entity';

export class TypeOrmReportRepository extends Repository<Report> { }
