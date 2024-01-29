import { EntityRepository } from '@mikro-orm/core';
import { Changelog } from '../changelog.entity';

export class MikroOrmChangelogRepository extends EntityRepository<Changelog> { }
