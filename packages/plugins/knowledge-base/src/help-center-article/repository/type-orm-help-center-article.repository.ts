import { Repository } from 'typeorm';
import { HelpCenterArticle } from '../help-center-article.entity';

export class TypeOrmHelpCenterArticleRepository extends Repository<HelpCenterArticle> { }