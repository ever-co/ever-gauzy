import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, FindOptionsWhere, IsNull, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as mjml2html from 'mjml';
import * as Handlebars from 'handlebars';
import { AccountingTemplateTypeEnum, IAccountingTemplate, IPagination, LanguagesEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { AccountingTemplate } from './accounting-template.entity';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';

@Injectable()
export class AccountingTemplateService extends TenantAwareCrudService<AccountingTemplate> {
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
		const tenantId = RequestContext.currentTenantId();

		const { success, record } = await this.findOneOrFailByWhereOptions({
			languageCode: data.languageCode,
			templateType: data.templateType,
			organizationId: data.organizationId,
			tenantId
		});

		let entity: AccountingTemplate;
		if (success) {
			entity = {
				...record,
				hbs: mjml2html(record.mjml).html,
				mjml: data.mjml
			};
			return await this.update(record.id, entity);
		} else {
			entity = new AccountingTemplate();
			entity.languageCode = data.languageCode;
			entity.templateType = data.templateType;
			entity.name = data.templateType;
			entity.mjml = data.mjml;
			entity.hbs = mjml2html(data.mjml).html;
			entity.organizationId = data.organizationId;
			entity.tenantId = tenantId;
			return await this.create(entity);
		}
	}


	async getAccountTemplate(
		options: FindOptionsWhere<AccountingTemplate>,
		themeLanguage: LanguagesEnum
	) {
		let template: any;
		const {
			templateType = AccountingTemplateTypeEnum.INVOICE,
			organizationId,
			languageCode = themeLanguage
		} = options;
		const tenantId = RequestContext.currentTenantId();

		try {
			template = await this.findOneByWhereOptions({
				languageCode,
				templateType,
				organizationId,
				tenantId
			});
		} catch (error) {
			const { success, record } = await this.findOneOrFailByWhereOptions({
				languageCode,
				templateType,
				organizationId: IsNull(),
				tenantId: IsNull()
			});
			if (success) {
				template = record
			} else {
				try {
					template = await this.findOneByWhereOptions({
						languageCode: LanguagesEnum.ENGLISH,
						templateType,
						organizationId,
						tenantId
					});
				} catch (error) {
					template = await this.findOneByWhereOptions({
						languageCode: LanguagesEnum.ENGLISH,
						templateType,
						organizationId: IsNull(),
						tenantId: IsNull()
					});
				}

			}
		}
		return template;
	}


	/**
	 * Get Accounting Templates using pagination params
	 *
	 * @param params
	 * @returns
	 */
	async findAll(
		params: PaginationParams<AccountingTemplate>
	): Promise<IPagination<IAccountingTemplate>> {
		const query = this.accountingRepository.createQueryBuilder('accounting_template');
		query.setFindOptions({
			relations: params.relations,
			order: params.order
		});
		query.where((qb: SelectQueryBuilder<AccountingTemplate>) => {
			qb.andWhere(
				new Brackets((bck: WhereExpressionBuilder) => {
					const { organizationId, languageCode } = params.where;
					if (isNotEmpty(organizationId)) {
						bck.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, {
							organizationId
						});
					}
					if (isNotEmpty(languageCode)) {
						bck.andWhere(`"${qb.alias}"."languageCode" = :languageCode`, {
							languageCode
						});
					}
					bck.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
						tenantId: RequestContext.currentTenantId()
					});
				})
			);
			qb.orWhere(
				new Brackets((bck: WhereExpressionBuilder) => {
					bck.andWhere(`"${qb.alias}"."organizationId" IS NULL`);
					bck.andWhere(`"${qb.alias}"."tenantId" IS NULL`);
				})
			)
		});
		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}
}
