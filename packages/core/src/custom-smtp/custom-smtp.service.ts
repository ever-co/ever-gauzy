import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import {
	ICustomSmtp,
	ICustomSmtpFindInput,
	ICustomSmtpValidateInput
} from '@gauzy/contracts';
import { isEmpty, ISMTPConfig } from '@gauzy/common';
import { environment as env } from '@gauzy/config';
import { TenantAwareCrudService } from './../core/crud';
import { CustomSmtp } from './custom-smtp.entity';

@Injectable()
export class CustomSmtpService extends TenantAwareCrudService<CustomSmtp> {
	constructor(
		@InjectRepository(CustomSmtp)
		protected readonly customSmtpRepository: Repository<CustomSmtp>
	) {
		super(customSmtpRepository);
	}

	/**
	 * GET SMTP settings for tenant/organization
	 *
	 * @param query
	 * @returns
	 */
	public async getSmtpSetting(
		query: ICustomSmtpFindInput
	): Promise<ICustomSmtp | ISMTPConfig> {
		const globalSmtp = this.defaultSMTPTransporter();
		delete globalSmtp['auth'];

		try {
			const { organizationId } = query;
			return await this.findOneByOptions({
				where: {
					organizationId: isEmpty(organizationId) ? IsNull() : organizationId
				},
				order: {
					createdAt: 'DESC'
				}
			});
		} catch (error) {
			return globalSmtp;
		}
	}

	/**
	 * Verifies SMTP configuration
	 *
	 * @param configuration
	 * @returns
	 */
	public async verifyTransporter(configuration: ICustomSmtpValidateInput): Promise<Boolean | any> {
		return new Promise((resolve, reject) => {
			try {
				const transporter = nodemailer.createTransport({
					host: configuration.host,
					port: configuration.port || 587,
					secure: configuration.secure || false, // use TLS
					auth: {
						user: configuration.username,
						pass: configuration.password
					},
					from: configuration.fromAddress
				});
				transporter.verify((error, success) => {
					if (error) {
						console.log('Error while verifing nodemailer transport!', error);
						reject(false);
					} else {
						resolve(true);
					}
				});
			} catch (error) {
				reject(false);
			}
		});
	}

	/*
	 * This example would connect to a SMTP server separately for every single message
	 */
	public defaultSMTPTransporter(): ISMTPConfig {
		const smtp: ISMTPConfig = env.smtpConfig;
		return {
			fromAddress: smtp.fromAddress,
			host: smtp.host,
			port: smtp.port,
			secure: smtp.secure, // true for 465, false for other ports
			auth: {
				user: smtp.auth.user,
				pass: smtp.auth.pass
			}
		};
	}
}
