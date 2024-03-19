import { EntityRepository } from '@mikro-orm/knex';
import { HelpCenterArticle } from '../help-center-article.entity';

export class MikroOrmHelpCenterArticleRepository extends EntityRepository<HelpCenterArticle> { }
