import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as Email from 'email-templates';
import * as nodemailer from 'nodemailer';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { User } from '../user';
import { EmailTemplate as IEmailTemplate } from './email-template.entity';

@Injectable()
export class EmailTemplateService extends CrudService<IEmailTemplate> {
	constructor(
		@InjectRepository(IEmailTemplate)
		private readonly emailRepository: Repository<IEmailTemplate>
	) {
		super(emailRepository);
	}
}
