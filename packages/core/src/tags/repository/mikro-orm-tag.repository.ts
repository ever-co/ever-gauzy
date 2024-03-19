import { EntityRepository } from '@mikro-orm/knex';
import { Tag } from '../tag.entity';

export class MikroOrmTagRepository extends EntityRepository<Tag> { }
