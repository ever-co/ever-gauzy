import { Injectable } from '@nestjs/common';
import { Brackets, IsNull, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as mjml2html from 'mjml';
import * as Handlebars from 'handlebars';
import {
	AccountingTemplateTypeEnum,
	IAccountingTemplate,
	IAccountingTemplateFindInput,
	IAccountingTemplateUpdateInput,
	IPagination,
	LanguagesEnum
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { AccountingTemplate } from './accounting-template.entity';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmAccountingTemplateRepository } from './repository/type-orm-accounting-template.repository';
import { MikroOrmAccountingTemplateRepository } from './repository/mikro-orm-accounting-template.repository';

@Injectable()
export class AccountingTemplateService extends TenantAwareCrudService<AccountingTemplate> {
	constructor(
		typeOrmAccountingTemplateRepository: TypeOrmAccountingTemplateRepository,
		mikroOrmAccountingTemplateRepository: MikroOrmAccountingTemplateRepository
	) {
		super(typeOrmAccountingTemplateRepository, mikroOrmAccountingTemplateRepository);
	}

	generatePreview(input) {
		const { data, organization } = input.request;
		let textToHtml = data;
		try {
			const mjmlToHtml = mjml2html(data);
			textToHtml = mjmlToHtml.errors.length ? data : mjmlToHtml.html;
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

	/**
	 * Save accounting template to the organization
	 *
	 * @param input
	 * @returns
	 */
	async saveTemplate(input: IAccountingTemplateUpdateInput) {
		const tenantId = RequestContext.currentTenantId();
		try {
			const record = await this.findOneByWhereOptions({
				languageCode: input.languageCode,
				templateType: input.templateType,
				organizationId: input.organizationId,
				tenantId
			});
			let entity: AccountingTemplate = {
				...record,
				hbs: mjml2html(record.mjml).html,
				mjml: input.mjml
			};
			return await this.update(record.id, entity);
		} catch (error) {
			const entity = new AccountingTemplate();
			entity.languageCode = input.languageCode;
			entity.templateType = input.templateType;
			entity.name = input.templateType;
			entity.mjml = input.mjml;
			entity.hbs = mjml2html(input.mjml).html;
			entity.organizationId = input.organizationId;
			entity.tenantId = tenantId;
			return await this.create(entity);
		}
	}

	/**
	 * GET single accounting template by conditions
	 *
	 * @param options
	 * @param themeLanguage
	 * @returns
	 */
	async getAccountTemplate(options: IAccountingTemplateFindInput, themeLanguage: LanguagesEnum) {
		const tenantId = RequestContext.currentTenantId();
		const {
			templateType = AccountingTemplateTypeEnum.INVOICE,
			organizationId,
			languageCode = themeLanguage
		} = options;
		try {
			return await this.typeOrmRepository.findOneBy({
				languageCode,
				templateType,
				organizationId,
				tenantId
			});
		} catch (error) {
			try {
				return await this.typeOrmRepository.findOneBy({
					languageCode,
					templateType,
					organizationId: IsNull(),
					tenantId: IsNull()
				});
			} catch (error) {
				try {
					return await this.typeOrmRepository.findOneBy({
						languageCode: LanguagesEnum.ENGLISH,
						templateType,
						organizationId,
						tenantId
					});
				} catch (error) {
					return await this.typeOrmRepository.findOneBy({
						languageCode: LanguagesEnum.ENGLISH,
						templateType,
						organizationId: IsNull(),
						tenantId: IsNull()
					});
				}
			}
		}
	}

	/**
	 * Get Accounting Templates using pagination params
	 *
	 * @param params
	 * @returns
	 */
	async findAll(params: PaginationParams<AccountingTemplate>): Promise<IPagination<IAccountingTemplate>> {
		const query = this.typeOrmRepository.createQueryBuilder('accounting_template');
		query.setFindOptions({
			select: {
				organization: {
					id: true,
					name: true,
					brandColor: true
				}
			},
			...(params && params.relations
				? {
						relations: params.relations
				  }
				: {}),
			...(params && params.order
				? {
						order: params.order
				  }
				: {})
		});
		query.where((qb: SelectQueryBuilder<AccountingTemplate>) => {
			qb.andWhere(
				new Brackets((bck: WhereExpressionBuilder) => {
					const { organizationId, languageCode } = params.where;
					if (isNotEmpty(organizationId)) {
						bck.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), {
							organizationId
						});
					}
					if (isNotEmpty(languageCode)) {
						bck.andWhere(p(`"${qb.alias}"."languageCode" = :languageCode`), {
							languageCode
						});
					}
					bck.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), {
						tenantId: RequestContext.currentTenantId()
					});
				})
			);
			qb.orWhere(
				new Brackets((bck: WhereExpressionBuilder) => {
					bck.andWhere(p(`"${qb.alias}"."organizationId" IS NULL`));
					bck.andWhere(p(`"${qb.alias}"."tenantId" IS NULL`));
				})
			);
		});
		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}
}
