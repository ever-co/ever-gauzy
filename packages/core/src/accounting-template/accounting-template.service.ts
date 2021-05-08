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
		const { data, organization } = input.request;
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
			from: organization,
			to: 'Sample Client',
			invoiceDate: '2021-02-23',
			dueDate: '2021-03-23',
			currency: 'BGN',
			tax: '20',
			tax2: '0',
			discountValue: '0',
			totalValue: '168',
			taxType: 'PERCENT',
			tax2Type: 'FLAT',
			discountType: 'PERCENT',
			hasRemainingAmountInvoiced: true,
			alreadyPaid: '0',
			amountDue: '168',
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
			],
			imgPath: 'assets/images/logos/ever-large.jpg',
			receiptNumber: '1',
			paymentDate: '2021-02-24',
			paymentMethod: 'Bank Transfer',
			receiptItems: [
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
			subtotal: '140',
			totalPaid: '168'
		});
		return { html };
	}

	async saveTemplate(input) {
		const { data } = input;

		const { success, record } = await this.findOneOrFail({
			languageCode: data.languageCode,
			templateType: data.templateType,
			organizationId: data.organizationId,
			tenantId: data.tenantId
		});

		let entity: AccountingTemplate;

		if (success) {
			entity = {
				...record,
				hbs: mjml2html(record.mjml).html,
				mjml: data.mjml
			};
			await this.update(record.id, entity);
		} else {
			entity = new AccountingTemplate();
			entity.languageCode = data.languageCode;
			entity.templateType = data.templateType;
			entity.name = data.templateType;
			entity.mjml = data.mjml;
			entity.hbs = mjml2html(data.mjml).html;
			entity.organizationId = data.organizationId;
			entity.tenantId = data.tenantId;
			await this.create(entity);
		}
	}


	async getAccountTemplate(input) {
		const { languageCode, templateType, organizationId, tenantId } = input;
		const { success, record } = await this.findOneOrFail({
			languageCode,
			templateType,
			organizationId,
			tenantId
		});
		if (success) {
			return record
		} else {
			return await this.findOne({
				languageCode,
				templateType,
			});
		}
	}
}
