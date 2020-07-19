import { CrudService } from '../core';
import { Invoice } from './invoice.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { getConnection } from 'typeorm';
import { EmailService } from '../email';
import { LanguagesEnum } from '@gauzy/models';
import { sign } from 'jsonwebtoken';
import { environment as env } from '@env-api/environment';
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
		originUrl: string
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
			originUrl
		);
	}

	createToken(email): string {
		const token: string = sign({ email }, env.JWT_SECRET, {});
		return token;
	}
}
