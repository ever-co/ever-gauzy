import { EntityRepository } from '@mikro-orm/knex';
import { HelpCenterAuthor } from '../help-center-author.entity';

export class MikroOrmHelpCenterAuthorRepository extends EntityRepository<HelpCenterAuthor> { }
