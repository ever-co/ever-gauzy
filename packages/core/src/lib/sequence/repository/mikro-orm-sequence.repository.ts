import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Sequence } from '../sequence.entity';

export class MikroOrmSequenceRepository extends MikroOrmBaseEntityRepository<Sequence> {}
