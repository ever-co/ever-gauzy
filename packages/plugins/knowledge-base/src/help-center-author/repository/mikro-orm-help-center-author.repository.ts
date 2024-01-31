import { EntityRepository } from '@mikro-orm/core';
import { HelpCenterAuthor } from '../help-center-author.entity';

export class MikroOrmHelpCenterAuthorRepository extends EntityRepository<HelpCenterAuthor> { }