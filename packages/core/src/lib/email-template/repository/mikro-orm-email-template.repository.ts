import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { EmailTemplate } from '../email-template.entity';

export class MikroOrmEmailTemplateRepository extends MikroOrmBaseEntityRepository<EmailTemplate> { }
