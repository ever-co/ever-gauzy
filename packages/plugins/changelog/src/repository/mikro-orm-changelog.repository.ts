import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Changelog } from '../changelog.entity';

export class MikroOrmChangelogRepository extends MikroOrmBaseEntityRepository<Changelog> { }
