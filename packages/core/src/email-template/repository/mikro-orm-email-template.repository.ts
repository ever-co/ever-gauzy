import { EntityRepository } from '@mikro-orm/knex';
import { EmailTemplate } from '../email-template.entity';

export class MikroOrmEmailTemplateRepository extends EntityRepository<EmailTemplate> { }
