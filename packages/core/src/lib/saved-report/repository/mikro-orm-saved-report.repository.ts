import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { SavedReport } from '../saved-report.entity';

export class MikroOrmSavedReportRepository extends MikroOrmBaseEntityRepository<SavedReport> {}
