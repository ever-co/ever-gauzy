import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { Changelog } from '../changelog.entity';

export class MikroOrmChangelogRepository extends MikroOrmBaseEntityRepository<Changelog> { }
