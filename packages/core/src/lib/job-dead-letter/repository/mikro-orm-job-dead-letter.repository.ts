import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { JobDeadLetter } from '../job-dead-letter.entity';

/**
 * MikroORM repository of JobDeadLetter. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmJobDeadLetterRepository extends MikroOrmBaseEntityRepository<JobDeadLetter> {}
