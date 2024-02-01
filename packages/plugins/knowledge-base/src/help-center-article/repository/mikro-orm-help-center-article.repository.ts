import { EntityRepository } from '@mikro-orm/core';
import { HelpCenterArticle } from '../help-center-article.entity';

export class MikroOrmHelpCenterArticleRepository extends EntityRepository<HelpCenterArticle> { }