import { EntityRepository } from '@mikro-orm/knex';
import { Changelog } from '../changelog.entity';

export class MikroOrmChangelogRepository extends EntityRepository<Changelog> { }
