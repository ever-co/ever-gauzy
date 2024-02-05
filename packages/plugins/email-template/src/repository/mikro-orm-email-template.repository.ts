import { EntityRepository } from '@mikro-orm/core';
import { EmailTemplate } from '../email-template.entity';

export class MikroOrmEmailTemplateRepository extends EntityRepository<EmailTemplate> { }