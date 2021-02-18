import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { AccountingTemplate as IAccountingTemplate } from './accounting-template.entity';
import * as mjml2html from 'mjml';
import * as Handlebars from 'handlebars';

@Injectable()
export class AccountingTemplateService extends CrudService<IAccountingTemplate> {
	constructor(
		@InjectRepository(IAccountingTemplate)
		private readonly accountingRepository: Repository<IAccountingTemplate>
	) {
		super(accountingRepository);
	}

	generatePreview(input) {
		const { data } = input;
		let textToHtml = data;
		try {
			const mjmlTohtml = mjml2html(data);
			textToHtml = mjmlTohtml.errors.length ? data : mjmlTohtml.html;
		} catch (error) {}

		const handlebarsTemplate = Handlebars.compile(textToHtml);
		const html = handlebarsTemplate({
			invoiceNumber: '556'
		});
		return { html };
	}
}
