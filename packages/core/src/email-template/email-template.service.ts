import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from './../core/crud';
import { EmailTemplate } from './email-template.entity';

@Injectable()
export class EmailTemplateService extends CrudService<EmailTemplate> {
	constructor(
		@InjectRepository(EmailTemplate)
		private readonly emailRepository: Repository<EmailTemplate>
	) {
		super(emailRepository);
	}
}
