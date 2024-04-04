import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate } from '../email-template.entity';

@Injectable()
export class TypeOrmEmailTemplateRepository extends Repository<EmailTemplate> {
    constructor(@InjectRepository(EmailTemplate) readonly repository: Repository<EmailTemplate>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
