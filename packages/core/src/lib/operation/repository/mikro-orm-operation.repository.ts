import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Operation } from '../operation.entity';

export class MikroOrmOperationRepository extends MikroOrmBaseEntityRepository<Operation> {}
