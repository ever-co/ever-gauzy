import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { JobExecution } from '../job-execution.entity';

/**
 * MikroORM repository of JobExecution. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmJobExecutionRepository extends MikroOrmBaseEntityRepository<JobExecution> {}
