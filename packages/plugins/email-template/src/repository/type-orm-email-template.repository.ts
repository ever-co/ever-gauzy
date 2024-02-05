import { Repository } from 'typeorm';
import { EmailTemplate } from '../email-template.entity';

export class TypeOrmEmailTemplateRepository extends Repository<EmailTemplate> { }