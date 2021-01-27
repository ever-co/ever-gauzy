import { CrudService } from '../core';
import { Invoice } from './invoice.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { getConnection } from 'typeorm';
import { EmailService } from '../email';
import { LanguagesEnum } from '@gauzy/contracts';
import { sign } from 'jsonwebtoken';
import { environment as env } from '@gauzy/config';
import { EstimateEmailService } from '../estimate-email/estimate-email.service';

@Injectable()
export class InvoiceService extends CrudService<Invoice> {
	constructor(
		@InjectRepository(Invoice)
		private readonly invoiceRepository: Repository<Invoice>,
		private readonly emailService: EmailService,
		private readonly estimateEmailService: EstimateEmailService
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
		const result = `localhost:4200/#/share/${
			isEstimate ? 'estimates' : 'invoices'
		}/${invoiceId}/${token}`;
		await this.invoiceRepository.update(invoiceId, {
			token: token,
			publicLink: result
		});
		return await this.invoiceRepository.findOne(invoiceId);
	}

	createToken(email): string {
		const token: string = sign({ email }, env.JWT_SECRET, {});
		return token;
	}
}
