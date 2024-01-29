import { Repository } from 'typeorm';
import { Report } from '../report.entity';

export class TypeOrmReportsRepository extends Repository<Report> { }
