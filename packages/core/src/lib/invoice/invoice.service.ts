import { BaseQueryDTO, TenantAwareCrudService } from './../core/crud';
import { Invoice } from './invoice.entity';
import { Between, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { EmailService } from './../email-send/email.service';
import { DecimalString, ID, IInvoice, IOrganization, InvoiceStats, LanguagesEnum } from '@gauzy/contracts';
import { addDecimalStrings, normalizeDecimalString } from '../money/decimal';
import { signPurposeToken, TokenPurposeEnum } from '../auth/purpose-token';
import { MultiORMEnum } from './../core/utils';
import { RequestContext } from './../core/context';
import { I18nService } from 'nestjs-i18n';
import * as moment from 'moment';
import { EstimateEmailService } from '../estimate-email/estimate-email.service';
import { Readable } from 'stream';
import { PdfmakerService } from './pdfmaker.service';
import { generateInvoicePdfDefinition, generateInvoicePaymentPdfDefinition } from './index';
import { OrganizationService } from './../organization';
import { TypeOrmInvoiceRepository } from './repository/type-orm-invoice.repository';
import { MikroOrmInvoiceRepository } from './repository/mikro-orm-invoice.repository';

/** One total of invoice values in one currency: how many documents, and their exact sum. */
export interface IInvoiceCurrencyTotal {
	currency: string;
	count: number;
	totalValue: DecimalString;
}

/** One status's total in one currency. */
export interface IInvoiceStatusTotal extends IInvoiceCurrencyTotal {
	status: string | null;
}

/** One organization's invoices (or estimates), counted and totalled per currency and per status. */
export interface IInvoiceStatistics {
	count: number;
	totals: IInvoiceCurrencyTotal[];
	byStatus: IInvoiceStatusTotal[];
}

@Injectable()
export class InvoiceService extends TenantAwareCrudService<Invoice> {
	constructor(
		readonly typeOrmInvoiceRepository: TypeOrmInvoiceRepository,
		readonly mikroOrmInvoiceRepository: MikroOrmInvoiceRepository,
		private readonly emailService: EmailService,
		private readonly estimateEmailService: EstimateEmailService,
		private readonly pdfmakerService: PdfmakerService,
		private readonly i18n: I18nService,
		private readonly organizationService: OrganizationService
	) {
		super(typeOrmInvoiceRepository, mikroOrmInvoiceRepository);
	}

	/**
	 * Retrieves the count and total amount of invoices where `isEstimate` is false.
	 *
	 * @returns {Promise<InvoiceStats>} An object containing the count of invoices and the total amount.
	 */
	async getInvoiceStats(): Promise<InvoiceStats> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const knex = this.mikroOrmRepository.getEntityManager().getKnex();
				// Raw knex bypasses the soft-delete filter that TypeORM's query builder applies
				const result = await knex('invoice')
					.where('isEstimate', false)
					.whereNull('deletedAt')
					.count('id as count')
					.sum('totalValue as amount')
					.first();
				return {
					count: parseInt(result?.count ?? '0', 10),
					amount: parseFloat(result?.amount ?? '0') || 0
				};
			}
			case MultiORMEnum.TypeORM:
			default: {
				const result = await this.typeOrmInvoiceRepository
					.createQueryBuilder('invoice')
					.select('COUNT(invoice.id)', 'count')
					.addSelect('SUM(invoice.totalValue)', 'amount')
					.where('invoice.isEstimate = :isEstimate', { isEstimate: false })
					.getRawOne();

				return {
					count: parseInt(result.count, 10),
					amount: parseFloat(result.amount) || 0
				};
			}
		}
	}

	/**
	 * One organization's invoices — or, when asked, its estimates — counted and totalled per currency and per
	 * status.
	 *
	 * Scoped where `getInvoiceStats` is not: that read feeds the platform-wide statistics and counts every
	 * tenant's invoices together, and is left as it is. This one reads only the credential's tenant (the CRUD
	 * read applies it) and the one organization named, and refuses to run without an organization rather
	 * than widening to the whole tenant. A soft-deleted document is not counted, because the CRUD read does
	 * not return it.
	 *
	 * Money is summed as exact decimal strings and never across currencies: an invoice in euros and one in
	 * dollars have no total. A document with no stored total counts and adds nothing.
	 *
	 * @param input The organization, and whether to read estimates instead of invoices (default: invoices).
	 * @returns The count, the totals per currency, and the totals per status and currency.
	 */
	async getStatistics(input: {
		tenantId?: ID;
		organizationId?: ID;
		isEstimate?: boolean;
	}): Promise<IInvoiceStatistics> {
		const { organizationId } = input ?? {};

		if (!organizationId) {
			throw new BadRequestException('INVOICE_ORGANIZATION_REQUIRED: invoice statistics are per organization.');
		}

		const rows = await this.find({
			where: { organizationId, isEstimate: input.isEstimate === true },
			select: { id: true, status: true, currency: true, totalValue: true }
		});

		const totals = new Map<string, IInvoiceCurrencyTotal>();
		const byStatus = new Map<string, IInvoiceStatusTotal>();

		for (const row of rows ?? []) {
			const currency = row.currency;
			const status = row.status ?? null;
			// The column is numeric; a driver may hand it over as a number or as text, and a document may hold
			// none. Each is read as the exact decimal it spells.
			const value = normalizeDecimalString(row.totalValue ?? 0);

			const total = totals.get(currency) ?? { currency, count: 0, totalValue: '0' };
			total.count += 1;
			total.totalValue = addDecimalStrings(total.totalValue, value);
			totals.set(currency, total);

			const key = `${status}|${currency}`;
			const bucket = byStatus.get(key) ?? { status, currency, count: 0, totalValue: '0' };
			bucket.count += 1;
			bucket.totalValue = addDecimalStrings(bucket.totalValue, value);
			byStatus.set(key, bucket);
		}

		return {
			count: rows?.length ?? 0,
			totals: Array.from(totals.values()).map((total) => ({
				...total,
				totalValue: normalizeDecimalString(total.totalValue)
			})),
			byStatus: Array.from(byStatus.values()).map((bucket) => ({
				...bucket,
				totalValue: normalizeDecimalString(bucket.totalValue)
			}))
		};
	}

	/**
	 * GET highest invoice number of the current tenant
	 *
	 * Invoices and estimates share one number sequence per tenant, and the unique constraint on
	 * `invoiceNumber` is tenant-local (tenantId, invoiceNumber). The aggregate runs on raw builders,
	 * which bypass TenantAwareCrudService scoping, so it must add the tenant predicate itself —
	 * unscoped, it disclosed the installation-wide maximum across tenants (GHSA-57hw-jqpj-ww97).
	 *
	 * @returns
	 */
	async getHighestInvoiceNumber(): Promise<IInvoice> {
		// Fail closed: without a tenant there is no sequence this caller may read.
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new ForbiddenException();
		}

		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const knex = this.mikroOrmRepository.getEntityManager().getKnex();
					const result = await knex(this.tableName).where({ tenantId }).max('invoiceNumber as max').first();
					return { max: result?.max ?? 0 } as any;
				}
				case MultiORMEnum.TypeORM:
				default: {
					const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
					return await query
						.select(`COALESCE(MAX(${query.alias}.invoiceNumber), 0)`, 'max')
						.where(`${query.alias}.tenantId = :tenantId`, { tenantId })
						.getRawOne();
				}
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	async sendEmail(
		languageCode: LanguagesEnum,
		email: string,
		invoiceNumber: number,
		invoiceId: string,
		isEstimate: boolean,
		origin: string,
		organizationId: string
	) {
		try {
			//create estimate email record
			const estimateEmail = await this.estimateEmailService.createEstimateEmail(invoiceId, email);
			const organization: IOrganization = await this.organizationService.findOneByIdString(organizationId);
			try {
				//generate estimate/invoice pdf and attached in email
				const buffer: Buffer = await this.generateInvoicePdf(invoiceId, languageCode);
				if (!buffer) throw new Error('PDF generation failed');
				const base64 = buffer?.toString('base64');

				await this.emailService.emailInvoice(
					languageCode,
					email,
					base64,
					invoiceNumber,
					invoiceId,
					isEstimate,
					estimateEmail.token,
					origin,
					organization
				);
			} catch (error) {
				console.log(`Error while sending estimate email ${invoiceNumber}: %s`, error?.message);
			}
		} catch (error) {
			console.log(`Error while creating estimate email for invoice ${invoiceId}: %s`, error?.message);
		}
	}

	/**
	 * Generate invoice public link
	 *
	 * @param invoiceId
	 * @returns
	 */
	async generateLink(invoiceId: string): Promise<IInvoice> {
		try {
			const invoice = await this.findOneByIdString(invoiceId);
			const payload = {
				id: invoice.id,
				organizationId: invoice.organizationId,
				tenantId: invoice.tenantId
			};
			return await this.create({
				id: invoiceId,
				token: signPurposeToken(TokenPurposeEnum.INVOICE_SHARE, payload)
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	async generateInvoicePdf(invoiceId: string, language: string) {
		const invoice: IInvoice = await this.findOneByIdString(invoiceId, {
			relations: [
				'fromOrganization',
				'invoiceItems.employee.user',
				'invoiceItems.employee',
				'invoiceItems.expense',
				'invoiceItems.product',
				'invoiceItems.product.translations',
				'invoiceItems.project',
				'invoiceItems.task',
				'invoiceItems',
				'toContact'
			]
		});
		const translatedText = {
			item: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.ITEM', { lang: language }),
			description: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION', {
				lang: language
			}),
			quantity: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.QUANTITY', {
				lang: language
			}),
			price: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.PRICE', { lang: language }),
			totalValue: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE', {
				lang: language
			}),

			invoice: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICE', { lang: language }),
			estimate: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.ESTIMATE', { lang: language }),
			number: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.NUMBER', { lang: language }),
			from: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.FROM', { lang: language }),
			to: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.TO', { lang: language }),
			date: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.DATE', { lang: language }),
			dueDate: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.DUE_DATE', { lang: language }),
			discountValue: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICES_SELECT_DISCOUNT_VALUE', {
				lang: language
			}),
			discountType: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.DISCOUNT_TYPE', {
				lang: language
			}),
			taxValue: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.TAX_VALUE', { lang: language }),
			taxType: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.TAX_TYPE', { lang: language }),
			currency: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.CURRENCY', { lang: language }),
			terms: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICES_SELECT_TERMS', {
				lang: language
			}),
			paid: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAID', { lang: language }),
			yes: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.YES', { lang: language }),
			no: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.NO', { lang: language }),
			alreadyPaid: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.ALREADY_PAID', { lang: language }),
			amountDue: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.AMOUNT_DUE', { lang: language })
		};
		const docDefinition = await generateInvoicePdfDefinition(
			invoice,
			invoice.fromOrganization,
			invoice.toContact,
			translatedText,
			language
		);
		return await this.pdfmakerService.generatePdf(docDefinition);
	}

	async generateInvoicePaymentPdf(invoiceId: string, language: string) {
		const invoice: IInvoice = await this.findOneByIdString(invoiceId, {
			relations: [
				'invoiceItems',
				'fromOrganization',
				'toContact',
				'payments',
				'payments.invoice',
				'payments.createdByUser'
			]
		});

		const translatedText = {
			overdue: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.OVERDUE', { lang: language }),
			onTime: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.ON_TIME', { lang: language }),
			paymentDate: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.PAYMENT_DATE', {
				lang: language
			}),
			amount: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.AMOUNT', { lang: language }),
			createdByUser: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.RECORDED_BY', {
				lang: language
			}),
			note: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.NOTE', { lang: language }),
			status: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.STATUS', { lang: language }),
			paymentsForInvoice: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.PAYMENTS_FOR_INVOICE',
				{ lang: language }
			),
			dueDate: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.DUE_DATE', { lang: language }),
			totalValue: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE', {
				lang: language
			}),
			totalPaid: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.TOTAL_PAID', {
				lang: language
			}),
			receivedFrom: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.RECEIVED_FROM', {
				lang: language
			}),
			receiver: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.RECEIVER', { lang: language })
		};

		const docDefinition = await generateInvoicePaymentPdfDefinition(
			invoice,
			invoice.payments,
			invoice.fromOrganization,
			invoice.toContact,
			invoice.alreadyPaid,
			translatedText
		);

		return await this.pdfmakerService.generatePdf(docDefinition);
	}

	getReadableStream(buffer: Buffer): Readable {
		const stream = new Readable();

		stream.push(buffer);
		stream.push(null);

		return stream;
	}

	/**
	 * GET invoices pagination by params
	 *
	 * @param filter
	 * @returns
	 */
	public pagination(filter?: BaseQueryDTO<any>) {
		if ('where' in filter) {
			const { where } = filter;
			if (where.tags) {
				filter.where.tags = {
					id: In(where.tags)
				};
			}
			if (where.toContact) {
				filter.where.toContact = {
					id: In(where.toContact)
				};
			}
			// The end bounds below cover their whole last second: the add/edit forms save dates with
			// `endOf('day')` (23:59:59.999), which a `HH:mm:ss` bound of 23:59:59 would exclude.
			if ('invoiceDate' in where) {
				const { invoiceDate } = where;
				const { startDate, endDate } = invoiceDate;

				if (startDate && endDate) {
					filter.where.invoiceDate = Between(
						moment.utc(startDate).format('YYYY-MM-DD HH:mm:ss'),
						moment.utc(endDate).endOf('second').format('YYYY-MM-DD HH:mm:ss.SSS')
					);
				} else {
					filter.where.invoiceDate = Between(
						moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss'),
						moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss')
					);
				}
			}
			if ('dueDate' in where) {
				const { dueDate } = where;
				const { startDate, endDate } = dueDate;

				if (startDate && endDate) {
					filter.where.dueDate = Between(
						moment.utc(startDate).format('YYYY-MM-DD HH:mm:ss'),
						moment.utc(endDate).endOf('second').format('YYYY-MM-DD HH:mm:ss.SSS')
					);
				} else {
					filter.where.dueDate = Between(
						moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss'),
						moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss')
					);
				}
			}

			if ('totalValue' in where && where.totalValue) {
				const { min, max } = where.totalValue as { min?: number; max?: number };

				if (min !== undefined && max !== undefined && min > max) {
					throw new BadRequestException('Minimum value cannot be greater than maximum value');
				}

				if (min !== undefined && max !== undefined) {
					filter.where.totalValue = Between(min, max);
				} else if (min !== undefined) {
					filter.where.totalValue = MoreThanOrEqual(min);
				} else if (max !== undefined) {
					filter.where.totalValue = LessThanOrEqual(max);
				}
			}
		}
		return super.paginate(filter);
	}
}
