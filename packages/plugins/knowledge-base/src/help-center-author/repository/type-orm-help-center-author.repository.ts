import { Repository } from 'typeorm';
import { HelpCenterAuthor } from '../help-center-author.entity';

export class TypeOrmHelpCenterAuthorRepository extends Repository<HelpCenterAuthor> { }