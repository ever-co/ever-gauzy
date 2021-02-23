import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { AccountingTemplate } from './accounting-template.entity';
import * as mjml2html from 'mjml';
import * as Handlebars from 'handlebars';

@Injectable()
export class AccountingTemplateService extends CrudService<AccountingTemplate> {
	constructor(
		@InjectRepository(AccountingTemplate)
		private readonly accountingRepository: Repository<AccountingTemplate>
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

		Handlebars.registerHelper('if_eq', function (a, b, opts) {
			if (a == b) {
				return opts.fn(this);
			} else {
				return opts.inverse(this);
			}
		});

		const html = handlebarsTemplate({
			invoiceNumber: '1',
			from: 'Ever Technologies LTD',
			to: 'Sample Client',
			invoiceDate: '2021-02-23',
			dueDate: '2021-03-23',
			currency: 'BGN',
			tax: '20',
			tax2: '12',
			discountValue: '20',
			totalValue: '144',
			taxType: 'PERCENT',
			tax2Type: 'FLAT',
			discountType: 'PERCENT',
			hasRemainingAmountInvoiced: true,
			alreadyPaid: '0',
			amountDue: '144',
			invoiceItems: [
				{
					name: 'Item 1',
					description: 'Desc 1',
					quantity: '1',
					price: '10',
					totalValue: '10'
				},
				{
					name: 'Item 2',
					description: 'Desc 2',
					quantity: '2',
					price: '20',
					totalValue: '40'
				},
				{
					name: 'Item 3',
					description: 'Desc 3',
					quantity: '3',
					price: '30',
					totalValue: '90'
				}
			],
			estimateNumber: '1',
			estimateDate: '2021-02-23',
			estimateDueDate: '2021-03-23',
			estimateItems: [
				{
					name: 'Item 1',
					description: 'Desc 1',
					quantity: '1',
					price: '10',
					totalValue: '10'
				},
				{
					name: 'Item 2',
					description: 'Desc 2',
					quantity: '2',
					price: '20',
					totalValue: '40'
				},
				{
					name: 'Item 3',
					description: 'Desc 3',
					quantity: '3',
					price: '30',
					totalValue: '90'
				}
			]
		});
		return { html };
	}

	async saveTemplate(input) {
		const { data } = input;

		const { success, record } = await this.findOneOrFail({
			languageCode: data.languageCode,
			name: data.name
		});

		let entity: AccountingTemplate;

		if (success) {
			entity = {
				...record,
				hbs: mjml2html(record.mjml).html
			};
			await this.update(record.id, entity);
		} else {
			entity = new AccountingTemplate();
			entity.languageCode = data.languageCode;
			entity.name = data.name;
			entity.mjml = data.mjml;
			entity.hbs = mjml2html(data.mjml).html;
			await this.create(entity);
		}
	}
}
