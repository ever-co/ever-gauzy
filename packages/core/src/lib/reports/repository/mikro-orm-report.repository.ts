import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Report } from '../report.entity';

export class MikroOrmReportRepository extends MikroOrmBaseEntityRepository<Report> { }
