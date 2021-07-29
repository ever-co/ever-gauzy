import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { EmailTemplate as IEmailTemplate } from './email-template.entity';

@Injectable()
export class EmailTemplateService extends TenantAwareCrudService<IEmailTemplate> {
	constructor(
		@InjectRepository(IEmailTemplate)
		private readonly emailRepository: Repository<IEmailTemplate>
	) {
		super(emailRepository);
	}
}
