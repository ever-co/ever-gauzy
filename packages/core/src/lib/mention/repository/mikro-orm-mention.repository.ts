import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Mention } from '../mention.entity';

export class MikroOrmMentionRepository extends MikroOrmBaseEntityRepository<Mention> {}
