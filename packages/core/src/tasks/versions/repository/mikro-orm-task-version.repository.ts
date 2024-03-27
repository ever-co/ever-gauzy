import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { TaskVersion } from '../version.entity';

export class MikroOrmTaskVersionRepository extends MikroOrmBaseEntityRepository<TaskVersion> { }
