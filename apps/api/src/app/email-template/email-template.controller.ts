import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateService } from './email-template.service';

@ApiTags('EmailTemplate')
@Controller()
export class EmailTemplateController extends CrudController<EmailTemplate> {
	constructor(private readonly emailTemplateService: EmailTemplateService) {
		super(emailTemplateService);
	}
}
