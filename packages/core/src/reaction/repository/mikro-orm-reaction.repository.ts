import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Reaction } from '../reaction.entity';

export class MikroOrmReactionRepository extends MikroOrmBaseEntityRepository<Reaction> {}
