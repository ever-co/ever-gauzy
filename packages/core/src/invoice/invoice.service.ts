import { getDateRangeFormat } from '../core';
import { TenantAwareCrudService } from './../core/crud';
import { Invoice } from './invoice.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { EmailService } from '../email';
import { IInvoice, IOrganization, LanguagesEnum } from '@gauzy/contracts';
import { sign } from 'jsonwebtoken';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { I18nService } from 'nestjs-i18n';
import { EstimateEmailService } from '../estimate-email/estimate-email.service';
import { PdfmakerService } from './pdfmaker.service';
import { Readable } from 'stream';
import {
	generateInvoicePdfDefinition,
	generateInvoicePaymentPdfDefinition
} from './index';
import { OrganizationService } from './../organization';

@Injectable()
export class InvoiceService extends TenantAwareCrudService<Invoice> {
	constructor(
		@InjectRepository(Invoice)
		private readonly invoiceRepository: Repository<Invoice>,
		private readonly emailService: EmailService,
		private readonly estimateEmailService: EstimateEmailService,
		private readonly configService: ConfigService,
		private readonly pdfmakerServier: PdfmakerService,
		private readonly i18n: I18nService,
		private readonly organizationService: OrganizationService
	) {
		super(invoiceRepository);
	}

	async getHighestInvoiceNumber() {
		const invoice = await this.invoiceRepository
			.createQueryBuilder('invoice')
			.select('MAX(invoice.invoiceNumber)', 'max')
			.getRawOne();
		return invoice;
	}

	async sendEmail(
		languageCode: LanguagesEnum,
		email: string,
		invoiceNumber: number,
		invoiceId: string,
		isEstimate: boolean,
		originUrl: string,
		organizationId: string
	) {
		const token = this.createToken(email);
		await this.estimateEmailService.createEstimateEmail(
			invoiceId,
			email,
			token
		);

		//generate estimate/invoice pdf and attached in email
		const buffer: Buffer = await this.generateInvoicePdf(
			invoiceId,
			languageCode
		);
		const base64 = buffer.toString('base64');

		const organization: IOrganization = await this.organizationService.findOneByIdString(organizationId);
		this.emailService.emailInvoice(
			languageCode,
			email,
			base64,
			invoiceNumber,
			invoiceId,
			isEstimate,
			token,
			originUrl,
			organization
		);
	}

	async generateLink(invoiceId: string, isEstimate: boolean) {
		const token = this.createToken(invoiceId);
		const clientBaseUrl = this.configService.get(
			'clientBaseUrl'
		) as keyof IEnvironment;
		const result = `${clientBaseUrl}/#/share/${
			isEstimate ? 'estimates' : 'invoices'
		}/${invoiceId}/${token}`;

		await this.invoiceRepository.update(invoiceId, {
			token: token,
			publicLink: result
		});
		return await this.invoiceRepository.findOne(invoiceId);
	}

	createToken(email): string {
		const JWT_SECRET = this.configService.get(
			'JWT_SECRET'
		) as keyof IEnvironment;
		const token: string = sign({ email }, JWT_SECRET, {});
		return token;
	}

	async generateInvoicePdf(invoiceId: string, langulage: string) {
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
			item: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.ITEM',
				{ lang: langulage }
			),
			description: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION',
				{ lang: langulage }
			),
			quantity: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.QUANTITY',
				{ lang: langulage }
			),
			price: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.PRICE',
				{ lang: langulage }
			),
			totalValue: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE',
				{ lang: langulage }
			),

			invoice: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.INVOICE',
				{ lang: langulage }
			),
			estimate: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.ESTIMATE',
				{ lang: langulage }
			),
			number: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.NUMBER',
				{ lang: langulage }
			),
			from: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.FROM',
				{ lang: langulage }
			),
			to: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.TO',
				{ lang: langulage }
			),
			date: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.DATE',
				{ lang: langulage }
			),
			dueDate: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.DUE_DATE',
				{ lang: langulage }
			),
			discountValue: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.INVOICES_SELECT_DISCOUNT_VALUE',
				{ lang: langulage }
			),
			discountType: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.DISCOUNT_TYPE',
				{ lang: langulage }
			),
			taxValue: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.TAX_VALUE',
				{ lang: langulage }
			),
			taxType: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.TAX_TYPE',
				{ lang: langulage }
			),
			currency: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.CURRENCY',
				{ lang: langulage }
			),
			terms: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.INVOICES_SELECT_TERMS',
				{ lang: langulage }
			),
			paid: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.PAID',
				{ lang: langulage }
			),
			yes: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.YES',
				{ lang: langulage }
			),
			no: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.NO',
				{ lang: langulage }
			),
			alreadyPaid: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.ALREADY_PAID',
				{ lang: langulage }
			),
			amountDue: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.AMOUNT_DUE',
				{ lang: langulage }
			)
		};
		const docDefinition = await generateInvoicePdfDefinition(
			invoice,
			invoice.fromOrganization,
			invoice.toContact,
			translatedText,
			langulage
		);
		return await this.pdfmakerServier.generatePdf(docDefinition);
	}

	async generateInvoicePaymentPdf(invoiceId: string, langulage: string) {
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
			overdue: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.OVERDUE',
				{ lang: langulage }
			),
			onTime: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.ON_TIME',
				{ lang: langulage }
			),
			paymentDate: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.PAYMENT_DATE',
				{ lang: langulage }
			),
			amount: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.AMOUNT',
				{ lang: langulage }
			),
			recordedBy: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.RECORDED_BY',
				{ lang: langulage }
			),
			note: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.NOTE',
				{ lang: langulage }
			),
			status: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.STATUS',
				{ lang: langulage }
			),
			paymentsForInvoice: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.PAYMENTS_FOR_INVOICE',
				{ lang: langulage }
			),
			dueDate: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.DUE_DATE',
				{ lang: langulage }
			),
			totalValue: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE',
				{ lang: langulage }
			),
			totalPaid: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.TOTAL_PAID',
				{ lang: langulage }
			),
			receivedFrom: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.RECEIVED_FROM',
				{ lang: langulage }
			),
			receiver: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.RECEIVER',
				{ lang: langulage }
			)
		};

		const docDefinition = await generateInvoicePaymentPdfDefinition(
			invoice,
			invoice.payments,
			invoice.fromOrganization,
			invoice.toContact,
			invoice.alreadyPaid,
			translatedText
		);

		return await this.pdfmakerServier.generatePdf(docDefinition);
	}

	getReadableStream(buffer: Buffer): Readable {
		const stream = new Readable();

		stream.push(buffer);
		stream.push(null);

		return stream;
	}

	public pagination(filter?: any) {		
		if ('where' in filter) {
			const { where } = filter;
			if (where.tags) {
				filter.where.tags = {
					id: In(where.tags)
				}
			}
			if (where.toContact) {
				filter.where.toContact = {
					id: In(where.toContact)
				}
			}
			if (where.invoiceDate) {
				const { start, end } = getDateRangeFormat(
					new Date(where.invoiceDate), 
					new Date(where.invoiceDate),
					true
				);
				filter.where.invoiceDate = Between(start, end);
			}
			if (where.dueDate) {
				const { start, end } = getDateRangeFormat(
					new Date(where.dueDate), 
					new Date(where.dueDate),
					true
				);
				filter.where.dueDate = Between(
					start,
					end
				);
			}
		}
		return super.paginate(filter);
	}
}
