import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { Invoice } from './invoice.entity';
import { Between, In } from 'typeorm';
import { BadRequestException, Injectable } from '@nestjs/common';
import { EmailService } from './../email-send/email.service';
import { IInvoice, IOrganization, InvoiceStats, LanguagesEnum } from '@gauzy/contracts';
import { sign } from 'jsonwebtoken';
import { environment } from '@gauzy/config';
import { I18nService } from 'nestjs-i18n';
import * as moment from 'moment';
import { EstimateEmailService } from '../estimate-email/estimate-email.service';
import { Readable } from 'stream';
import { PdfmakerService } from './pdfmaker.service';
import { generateInvoicePdfDefinition, generateInvoicePaymentPdfDefinition } from './index';
import { OrganizationService } from './../organization';
import { TypeOrmInvoiceRepository } from './repository/type-orm-invoice.repository';
import { MikroOrmInvoiceRepository } from './repository/mikro-orm-invoice.repository';

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

	/**
	 * GET highest invoice number
	 *
	 * @returns
	 */
	async getHighestInvoiceNumber(): Promise<IInvoice> {
		try {
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			return await query.select(`COALESCE(MAX(${query.alias}.invoiceNumber), 0)`, 'max').getRawOne();
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
				token: sign(payload, environment.JWT_SECRET, {})
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
				'payments.recordedBy'
			]
		});

		const translatedText = {
			overdue: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.OVERDUE', { lang: language }),
			onTime: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.ON_TIME', { lang: language }),
			paymentDate: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.PAYMENT_DATE', {
				lang: language
			}),
			amount: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.AMOUNT', { lang: language }),
			recordedBy: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.RECORDED_BY', {
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
	public pagination(filter?: PaginationParams<any>) {
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
			if ('invoiceDate' in where) {
				const { invoiceDate } = where;
				const { startDate, endDate } = invoiceDate;

				if (startDate && endDate) {
					filter.where.invoiceDate = Between(
						moment.utc(startDate).format('YYYY-MM-DD HH:mm:ss'),
						moment.utc(endDate).format('YYYY-MM-DD HH:mm:ss')
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
						moment.utc(endDate).format('YYYY-MM-DD HH:mm:ss')
					);
				} else {
					filter.where.dueDate = Between(
						moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss'),
						moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss')
					);
				}
			}
		}
		return super.paginate(filter);
	}
}
