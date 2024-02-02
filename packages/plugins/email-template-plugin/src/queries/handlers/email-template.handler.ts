
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EmailTemplateService } from './../../email-template.service';
import { EmailTemplateQuery } from '../email-template.query';

@QueryHandler(EmailTemplateQuery)
export class EmailTemplateQueryHandler
    implements IQueryHandler<EmailTemplateQuery> {

    constructor(
        private readonly emailTemplateService: EmailTemplateService
    ) {}

    async execute(query: EmailTemplateQuery) {
        const { options } = query;
        return await this.emailTemplateService.findAll(options);
    }
}

