import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Dashboard } from '../dashboard.entity';

export class MikroOrmDashboardRepository extends MikroOrmBaseEntityRepository<Dashboard> {}
