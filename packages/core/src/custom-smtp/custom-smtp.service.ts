import {
	ICustomSmtp,
	ICustomSmtpCreateInput,
	ICustomSmtpFindInput
} from '@gauzy/contracts';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ISMTPConfig } from '@gauzy/common';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { CustomSmtp } from './custom-smtp.entity';
import { EmailService } from '../email/email.service';

@Injectable()
export class CustomSmtpService extends TenantAwareCrudService<CustomSmtp> {
	constructor(
		@InjectRepository(CustomSmtp)
		private readonly customSmtpRepository: Repository<CustomSmtp>,

		@Inject(forwardRef(() => EmailService))
		private readonly emailService: EmailService
	) {
		super(customSmtpRepository);
	}

	async getSmtpSetting(
		query: ICustomSmtpFindInput
	): Promise<ICustomSmtp | ISMTPConfig> {
		const { tenantId, organizationId } = query;
		const globalSmtp = this.emailService.createSMTPTransporter();
		try {
			if (!organizationId) {
				const organizationSmtp = await this.customSmtpRepository.findOne(
					{
						where: {
							tenantId,
							organizationId: IsNull()
						}
					}
				);
				return organizationSmtp || globalSmtp;
			}
			const tenantSmtp = await this.customSmtpRepository.findOne({
				where: {
					tenantId,
					organizationId: organizationId
				}
			});
			return tenantSmtp || globalSmtp;
		} catch {
			return globalSmtp;
		}
	}

	// Verify connection configuration
	async verifyTransporter(configuration: ICustomSmtpCreateInput) {
		return new Promise((resolve, reject) => {
			try {
				const transporter = nodemailer.createTransport({
					host: configuration.host,
					port: configuration.port || 587,
					secure: configuration.secure || false, // use TLS
					auth: {
						user: configuration.username,
						pass: configuration.password
					}
				});
				transporter.verify(function (error, success) {
					if (error) {
						console.log(error);
						reject(false);
					} else {
						console.log('Server is ready to take our messages');
						resolve(true);
					}
				});
			} catch (error) {
				reject(false);
			}
		});
	}
}
