import { CrudService } from '../core';
import { Invoice } from './invoice.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { getConnection } from 'typeorm';
import { EmailService } from '../email';
import { LanguagesEnum } from '@gauzy/contracts';
import { sign } from 'jsonwebtoken';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { I18nService } from 'nestjs-i18n';
import { EstimateEmailService } from '../estimate-email/estimate-email.service';
import { generateInvoicePdfDefinition } from './generate-invoice-pdf';
import { PdfmakerService } from './pdfmaker.service';

@Injectable()
export class InvoiceService extends CrudService<Invoice> {
	constructor(
		@InjectRepository(Invoice)
		private readonly invoiceRepository: Repository<Invoice>,
		private readonly emailService: EmailService,
		private readonly estimateEmailService: EstimateEmailService,
		private readonly configService: ConfigService,
		private readonly pdfmakerServier: PdfmakerService,
		private readonly i18n: I18nService
	) {
		super(invoiceRepository);
	}

	async getHighestInvoiceNumber() {
		const invoice = await getConnection()
			.createQueryBuilder(Invoice, 'invoice')
			.select('MAX(invoice.invoiceNumber)', 'max')
			.getRawOne();

		return invoice;
	}

	async sendEmail(
		languageCode: LanguagesEnum,
		email: string,
		base64: string,
		invoiceNumber: number,
		invoiceId: string,
		isEstimate: boolean,
		originUrl: string,
		tenantId: string,
		organizationId: string
	) {
		const token = this.createToken(email);
		await this.estimateEmailService.createEstimateEmail(
			invoiceId,
			email,
			token
		);
		this.emailService.emailInvoice(
			languageCode,
			email,
			base64,
			invoiceNumber,
			invoiceId,
			isEstimate,
			token,
			originUrl,
			tenantId,
			organizationId
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

	async generatePdf(invoiceId: string, langulage: string) {
		const invoice = await this.findOne(invoiceId, {
			relations: [
				'fromOrganization',
				'invoiceItems.employee.user',
				'invoiceItems.employee',
				'invoiceItems.expense',
				'invoiceItems.product',
				'invoiceItems.project',
				'invoiceItems.task',
				'invoiceItems',
				'toContact'
			]
		});
		const translatedText = {
			item: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.ITEM',
				{
					lang: langulage
				}
			),
			description: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE',
				{
					lang: langulage
				}
			),
			quantity: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.QUANTITY',
				{
					lang: langulage
				}
			),
			price: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.PRICE',
				{
					lang: langulage
				}
			),
			totalValue: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE',
				{
					lang: langulage
				}
			)
		};

		const docDefinition = await generateInvoicePdfDefinition(
			invoice,
			invoice.fromOrganization,
			invoice.toContact,
			translatedText
		);

		return this.pdfmakerServier.generatePdf(docDefinition);
	}
}
