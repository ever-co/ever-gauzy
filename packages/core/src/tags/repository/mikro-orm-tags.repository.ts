import { EntityRepository } from '@mikro-orm/core';
import { Tag } from '../tag.entity';

export class MikroOrmTagsRepository extends EntityRepository<Tag> { }
